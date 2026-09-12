import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPublicSnapshot, MAX_CSV_CHARACTERS, MAX_LIBRARY, mergeSnapshot, normalizeState, parseCsv, safeUrl } from "../lib/core.js";
import { atomFeed } from "../lib/render.js";

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
  assert.equal(rows[0].source, "NovelFire");
});

test("parseCsv recognizes NovelPhoenix.com snapshots", () => {
  const rows = parseCsv(`Title,Author,Source,Book URL,Last read chapter,Last read URL,Chapters read,Total chapters,Progress (%)\nReverend Insanity,Gu Zhen Ren,NovelPhoenix.com,https://novelphoenix.com/novel/reverend-insanity,Chapter 1970,https://novelphoenix.com/novel/reverend-insanity/chapter-1970,1970,2334,84.4`);
  assert.equal(rows[0].source, "NovelPhoenix.com");
  assert.equal(rows[0].chaptersRead, 1970);
  assert.equal(rows[0].totalChapters, 2334);
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

test("atomFeed renders a well-formed entry per history event and escapes text content", () => {
  const advanced = mergeSnapshot(normalizeState({}), parseCsv(firstCsv), { importedAt: "2026-08-12T12:00:00Z" });
  const secondRows = parseCsv(firstCsv.replace('"10","100","10"', '"14","100","14"').replace('"A Novel"', '"A & B <Novel>"'));
  const withHistory = mergeSnapshot(advanced.state, secondRows, { importedAt: "2026-08-13T12:00:00Z" }).state;
  const feed = atomFeed(withHistory, { siteUrl: "https://example.test" });
  assert.match(feed, /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.equal((feed.match(/<entry>/g) || []).length, 1);
  assert.match(feed, /<title>A &amp; B &lt;Novel&gt;: chapter 10 to 14<\/title>/);
  assert.doesNotMatch(feed, /<title>A & B <Novel>:/, "raw, unescaped title text must never reach the feed");
  assert.match(feed, /<link href="https:\/\/novelfire\.net\/book\/a\/chapter-10"\/>/);

  const empty = atomFeed(normalizeState({}), { siteUrl: "https://example.test" });
  assert.match(empty, /<feed[\s\S]*<\/feed>/);
  assert.equal((empty.match(/<entry>/g) || []).length, 0);
});

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const render = await readFile(new URL("../lib/render.js", import.meta.url), "utf8");
const legalFiles = await Promise.all(["privacy", "terms", "accessibility", "security"].map((name) => readFile(new URL(`../${name}.html`, import.meta.url), "utf8")));
const pagesWorkflow = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
const codeqlWorkflow = await readFile(new URL("../.github/workflows/codeql.yml", import.meta.url), "utf8");
const securityText = await readFile(new URL("../.well-known/security.txt", import.meta.url), "utf8");
const publicSecurityText = await readFile(new URL("../security.txt", import.meta.url), "utf8");
const exporter = await readFile(new URL("../novelfire-readlist.js", import.meta.url), "utf8");
const userScript = await readFile(new URL("../novelfire-readlist.user.js", import.meta.url), "utf8");
const llms = await readFile(new URL("../llms.txt", import.meta.url), "utf8");
const robots = await readFile(new URL("../robots.txt", import.meta.url), "utf8");
const vercel = await readFile(new URL("../vercel.json", import.meta.url), "utf8");
const buildScript = await readFile(new URL("../scripts/build.mjs", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
const sitemap = await readFile(new URL("../sitemap.xml", import.meta.url), "utf8");

test("site has production metadata and a restrictive CSP", () => {
  assert.match(index, /Content-Security-Policy/);
  assert.match(index, /object-src 'none'/);
  assert.match(index, /worker-src 'none'/);
  assert.match(index, /form-action 'none'/);
  assert.ok(index.indexOf("Content-Security-Policy") < index.indexOf('name="viewport"'));
  assert.match(index, /rel="canonical"/);
  assert.match(index, /manifest\.webmanifest/);
  assert.match(index, /property="og:image"/);
  assert.match(index, /application\/ld\+json/);
  assert.equal((index.match(/<h1\b/g) || []).length, 1);
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
  assert.match(publicSecurityText, /security\/advisories\/new/);
  assert.match(publicSecurityText, /Canonical: https:\/\/novel-phoenix-readlist\.vercel\.app\/security\.txt/);
  assert.match(legalFiles[3], /\.\/security\.txt/);
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
  assert.match(render, /noopener noreferrer/);
});

test("app.js and the build-time pre-renderer share one row-rendering implementation", () => {
  assert.match(app, /from "\.\/lib\/render\.js"/);
  assert.doesNotMatch(app, /function escapeHtml/);
  assert.doesNotMatch(app, /function bookRow/);
  assert.match(buildScript, /from "\.\.\/lib\/render\.js"/);
  assert.doesNotMatch(buildScript, /const escapeHtml =/);
});

test("all production scripts are local modules", () => {
  assert.doesNotMatch(index, /<script[^>]+https?:\/\//i);
  assert.match(index, /<script type="module" src="\.\/app\.js\?v=[^"]+"><\/script>/);
});

test("SEO and crawler support is complete", () => {
  const pages = [index, ...legalFiles];
  for (const html of pages) {
    assert.match(html, /<html lang="en">/);
    assert.match(html, /name="description"/);
    assert.match(html, /rel="canonical"/);
    assert.match(html, /property="og:image"/);
    assert.match(html, /application\/ld\+json/);
    assert.match(html, /rel="icon"/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
  }
  assert.match(llms, /NovelPhoenix\.com/);
  assert.match(robots, /User-agent: GPTBot[\s\S]*Allow: \//);
  assert.match(robots, /sitemap\.xml/i);
});

test("sitemap.xml lists every indexable page's actual canonical URL", () => {
  const pages = [index, ...legalFiles];
  const canonicals = pages.map((html) => html.match(/rel="canonical" href="([^"]+)"/)?.[1]);
  assert.equal(canonicals.length, pages.length, "every indexable page must declare a canonical URL");
  for (const url of canonicals) assert.match(sitemap, new RegExp(`<loc>${url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc>`), `sitemap.xml is missing ${url}`);
  assert.equal((sitemap.match(/<loc>/g) || []).length, canonicals.length, "sitemap.xml must not list stale or extra URLs");
});

test("no page ships a non-square social-card image as its apple-touch-icon", () => {
  for (const html of [index, ...legalFiles]) {
    assert.doesNotMatch(html, /rel="apple-touch-icon"/);
  }
});

test("all pages declare a light and dark theme-color matching the site's default palette", () => {
  const lightPaper = css.match(/--paper:(#[0-9a-f]{6})/i)?.[1];
  assert.equal(lightPaper, manifest.background_color, "styles.css --paper and manifest.webmanifest background_color must not drift apart");
  for (const html of [index, ...legalFiles]) {
    assert.match(html, new RegExp(`name="theme-color" content="${lightPaper}" media="\\(prefers-color-scheme: light\\)"`));
    assert.match(html, /name="theme-color" content="#111210" media="\(prefers-color-scheme: dark\)"/);
  }
});

test("reading history is published as a discoverable Atom feed", () => {
  assert.match(index, /rel="alternate" type="application\/atom\+xml" href="\.\/feed\.xml"/);
  assert.match(index, /href="\.\/feed\.xml">Reading history feed<\/a>/);
  assert.match(render, /application\/atom\+xml/);
  assert.match(buildScript, /atomFeed\(/);
  assert.match(llms, /feed\.xml/);
});

test("exporter supports both reading sources without unbounded requests", () => {
  assert.match(userScript, /@match\s+https:\/\/novelfire\.net\/account\/library\*/);
  assert.match(userScript, /@match\s+https:\/\/novelphoenix\.com\/\*/);
  assert.match(exporter, /NovelPhoenix\.com/);
  assert.ok(exporter.includes('a[href*="/novel/"]'));
  assert.match(exporter, /mapConcurrent\(items, 4/);
  assert.match(exporter, /This is not a personal library page/);
});

test("Vercel uses the static build and hardened response headers", () => {
  const config = JSON.parse(vercel);
  assert.equal(config.outputDirectory, "dist");
  assert.equal(config.cleanUrls, true);
  const headers = config.headers.flatMap((rule) => rule.headers || []);
  assert.ok(headers.some((header) => header.key === "Content-Security-Policy" && /frame-ancestors 'none'/.test(header.value)));
  assert.ok(headers.some((header) => header.key === "X-Content-Type-Options" && header.value === "nosniff"));
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
