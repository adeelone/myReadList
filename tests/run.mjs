import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPublicSnapshot, MAX_CSV_CHARACTERS, MAX_LIBRARY, mergeSnapshot, normalizeState, parseCsv, safeUrl } from "../lib/core.js";

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const firstCsv = `"Title","Author","Book URL","Last read chapter","Last read URL","Chapters read","Total chapters","Progress (%)","Library order","Exported at"
"A Novel","An Author","https://novelfire.net/book/a","Chapter 10, The Trial","https://novelfire.net/book/a/chapter-10","10","100","10","1","2026-08-12T12:00:00Z"`;

test("parseCsv supports quoted commas and production metadata", () => {
  const rows = parseCsv(firstCsv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].chapterTitle, "Chapter 10, The Trial");
  assert.equal(rows[0].libraryOrder, 1);
  assert.equal(rows[0].exportedAt, "2026-08-12T12:00:00.000Z");
});

test("parseCsv remains compatible with legacy headings", () => {
  const rows = parseCsv(`Title,Book URL,Last chapter title,Last chapter URL,Chapters I have read,Chapter amount\nLegacy,https://novelfire.net/book/legacy,Chapter 3,https://novelfire.net/book/legacy/chapter-3,3,30`);
  assert.equal(rows[0].chapterTitle, "Chapter 3");
  assert.equal(rows[0].chaptersRead, 3);
  assert.equal(rows[0].progress, 10);
});

test("unsafe URL protocols are discarded", () => {
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("data:text/html,test"), "");
  assert.equal(safeUrl("https://novelfire.net/book/safe"), "https://novelfire.net/book/safe");
});

test("oversized snapshots are rejected before publication", () => {
  assert.throws(() => parseCsv("x".repeat(MAX_CSV_CHARACTERS + 1)), /5 MB safety limit/);
  assert.throws(() => mergeSnapshot({}, Array.from({ length: MAX_LIBRARY + 1 }, () => ({ title: "Too many" }))), /5,000 novel safety limit/);
});

test("mergeSnapshot records only forward reading progress", () => {
  const first = mergeSnapshot(normalizeState({}), parseCsv(firstCsv), { importedAt: "2026-08-12T12:00:00Z", fileName: "first.csv" });
  assert.equal(first.changes, 0);
  const secondRows = parseCsv(firstCsv.replace('"10","100","10"', '"14","100","14"').replace("chapter-10", "chapter-14").replace("Chapter 10", "Chapter 14"));
  const second = mergeSnapshot(first.state, secondRows, { importedAt: "2026-08-13T12:00:00Z", fileName: "second.csv" });
  assert.equal(second.changes, 1);
  assert.equal(second.state.history[0].fromChapter, 10);
  assert.equal(second.state.history[0].toChapter, 14);
  assert.equal(second.state.imports.length, 2);
});

test("public snapshots remove local file names", () => {
  const state = mergeSnapshot(normalizeState({}), parseCsv(firstCsv), { importedAt: "2026-08-12T12:00:00Z", fileName: "private-name.csv" }).state;
  const published = createPublicSnapshot(state, "2026-08-12T13:00:00Z");
  assert.equal(published.imports[0].fileName, undefined);
  assert.equal(published.imports[0].label, "NovelFire snapshot");
  assert.equal(published.generatedAt, "2026-08-12T13:00:00.000Z");
});

test("normalizeState clamps corrupt progress values", () => {
  const state = normalizeState({ library: [{ title: "High", progress: 900 }, { title: "Low", progress: -3 }] });
  assert.equal(state.library[0].progress, 100);
  assert.equal(state.library[1].progress, 0);
});

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const legalFiles = await Promise.all(["privacy", "terms", "accessibility", "security"].map((name) => readFile(new URL(`../${name}.html`, import.meta.url), "utf8")));
const pagesWorkflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
const codeqlWorkflow = await readFile(new URL("../.github/workflows/codeql.yml", import.meta.url), "utf8");
const securityText = await readFile(new URL("../.well-known/security.txt", import.meta.url), "utf8");

test("site has production metadata and a restrictive CSP", () => {
  assert.match(index, /Content-Security-Policy/);
  assert.match(index, /object-src 'none'/);
  assert.match(index, /worker-src 'none'/);
  assert.match(index, /form-action 'none'/);
  assert.ok(index.indexOf("Content-Security-Policy") < index.indexOf('name="viewport"'));
  assert.match(index, /rel="canonical"/);
  assert.match(index, /manifest\.webmanifest/);
});

test("legal, accessibility, and security disclosures are published", () => {
  for (const html of legalFiles) {
    assert.match(html, /Content-Security-Policy/);
    assert.match(html, /Novel Phoenix/);
    assert.doesNotMatch(html, /<script[^>]+https?:\/\//i);
  }
  assert.match(index, /privacy\.html/);
  assert.match(index, /security\.html/);
  assert.match(securityText, /security\/advisories\/new/);
});

test("deployment and security actions are immutable and least privilege", () => {
  assert.doesNotMatch(`${pagesWorkflow}\n${codeqlWorkflow}`, /uses:\s+[^\s]+@v\d/);
  assert.match(pagesWorkflow, /persist-credentials: false/);
  assert.match(pagesWorkflow, /permissions:\n\s+contents: read/);
  assert.match(codeqlWorkflow, /security-events: write/);
  assert.match(codeqlWorkflow, /github\/codeql-action\/analyze@[0-9a-f]{40}/);
});

test("application loads published data and labels local drafts", () => {
  assert.match(app, /\.\/data\/library\.json/);
  assert.match(app, /Local draft - not published/);
  assert.match(app, /createPublicSnapshot/);
  assert.match(app, /MAX_IMPORT_BYTES/);
  assert.match(app, /noopener noreferrer/);
});

test("all production scripts are local modules", () => {
  assert.doesNotMatch(index, /<script[^>]+https?:\/\//i);
  assert.match(index, /<script type="module" src="\.\/app\.js\?v=[^"]+"><\/script>/);
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

console.log(`${tests.length - failures}/${tests.length} tests passed`);
if (failures) process.exitCode = 1;
