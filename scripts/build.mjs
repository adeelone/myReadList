import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normalizeState } from "../lib/core.js";
import { atomFeed, bookRow } from "../lib/render.js";

const SITE_URL = "https://novel-phoenix-readlist.vercel.app";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const files = [
  "index.html",
  "404.html",
  "privacy.html",
  "terms.html",
  "accessibility.html",
  "security.html",
  "security.txt",
  "styles.css",
  "app.js",
  "theme-boot.js",
  "favicon.svg",
  "social-card.png",
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "llms-full.txt",
  ".well-known/security.txt",
  ".nojekyll",
  "novelfire-readlist.user.js",
  "novelfire-readlist.bookmarklet.txt"
];

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, "lib"), { recursive: true });
await mkdir(path.join(output, "data"), { recursive: true });
await mkdir(path.join(output, ".well-known"), { recursive: true });

for (const file of files) await cp(path.join(root, file), path.join(output, file));
await cp(path.join(root, "lib", "core.js"), path.join(output, "lib", "core.js"));
await cp(path.join(root, "lib", "render.js"), path.join(output, "lib", "render.js"));
await cp(path.join(root, "data", "library.json"), path.join(output, "data", "library.json"));

const index = await readFile(path.join(output, "index.html"), "utf8");
for (const required of ["Content-Security-Policy", "manifest.webmanifest", "type=\"module\"", "data/library.json"]) {
  if (!index.includes(required) && required !== "data/library.json") throw new Error(`index.html is missing ${required}`);
}

const publicState = normalizeState(JSON.parse(await readFile(path.join(output, "data", "library.json"), "utf8")));
await writeFile(path.join(output, "data", "library.json"), `${JSON.stringify(publicState, null, 2)}\n`);

const formatDate = (value) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Denver" }).format(new Date(value)) : "Not recorded";
const rows = [...publicState.library].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt) || b.chaptersRead - a.chaptersRead).map((book) => bookRow(book, { formatDate, locale: "en-US" })).join("");
const chaptersRead = publicState.library.reduce((sum, book) => sum + book.chaptersRead, 0);
const averageProgress = publicState.library.length ? publicState.library.reduce((sum, book) => sum + book.progress, 0) / publicState.library.length : 0;
const renderedIndex = index
  .replace('<div class="data-status" id="dataStatus" role="status">Loading public library...</div>', `<div class="data-status" id="dataStatus" role="status" data-source="public">Public library - updated ${formatDate(publicState.generatedAt)}</div>`)
  .replace('<strong id="statBooks">0</strong>', `<strong id="statBooks">${publicState.library.length.toLocaleString("en-US")}</strong>`)
  .replace('<strong id="statRead">0</strong>', `<strong id="statRead">${chaptersRead.toLocaleString("en-US")}</strong>`)
  .replace('<strong id="statAverage">0%</strong>', `<strong id="statAverage">${averageProgress.toFixed(1)}%</strong>`)
  .replace('<p id="resultsCount">0 novels</p>', `<p id="resultsCount">${publicState.library.length.toLocaleString("en-US")} novels</p>`)
  .replace('<tbody id="tableBody"></tbody>', `<tbody id="tableBody">${rows}</tbody>`);
await writeFile(path.join(output, "index.html"), renderedIndex);

await writeFile(path.join(output, "feed.xml"), atomFeed(publicState, { siteUrl: SITE_URL }));

console.log(`Built Novel Phoenix into ${output}`);
console.log(`Published snapshot: ${publicState.library.length} novels, ${publicState.history.length} reading events`);
