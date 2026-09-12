import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const pages = ["index.html", "privacy.html", "terms.html", "accessibility.html", "security.html", "404.html"];
const titles = new Set();

for (const file of pages) {
  const html = await readFile(path.join(dist, file), "utf8");
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  assert.ok(title, `${file} needs a title`);
  assert.ok(!titles.has(title), `${file} repeats the title ${title}`);
  titles.add(title);
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file} must contain exactly one h1`);
  for (const signal of ['name="description"', 'rel="canonical"', 'property="og:image"', 'type="application/ld+json"', 'rel="icon"', '<html lang="en">']) assert.ok(html.includes(signal), `${file} is missing ${signal}`);
}

const index = await readFile(path.join(dist, "index.html"), "utf8");
assert.equal((index.match(/class="title-link"/g) || []).length, 110, "view-source must contain all 110 pre-rendered novel rows");
assert.ok(index.includes("Complete Martial Arts Attributes"), "view-source is missing real library content");

for (const required of ["404.html", "favicon.svg", "social-card.png", "sitemap.xml", "robots.txt", "llms.txt", "llms-full.txt", "feed.xml", "lib/render.js"]) await stat(path.join(dist, required));
const png = await readFile(path.join(dist, "social-card.png"));
assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "social-card.png is not a PNG");
await assert.rejects(stat(path.join(dist, "social-card.svg")), "unreferenced social-card.svg source art must not ship in the production build");

const publicState = JSON.parse(await readFile(path.join(dist, "data", "library.json"), "utf8"));
const feed = await readFile(path.join(dist, "feed.xml"), "utf8");
assert.match(feed, /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">/, "feed.xml must be a well-formed Atom feed");
assert.equal((feed.match(/<entry>/g) || []).length, publicState.history.length, "feed.xml entry count must match the published history length");

const files = await walk(dist);
assert.equal(files.filter((file) => file.endsWith(".map")).length, 0, "production source maps must not be published");
for (const file of files.filter((name) => name.endsWith(".js"))) {
  const size = (await stat(file)).size;
  assert.ok(size < 50_000, `${path.basename(file)} exceeds the 50 KB JavaScript budget (${size} bytes)`);
}

console.log(`PASS production artifact audit: ${pages.length} pages, 110 pre-rendered novels, ${publicState.history.length} feed entries, no source maps, JS files under 50 KB`);

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(target)); else output.push(target);
  }
  return output;
}
