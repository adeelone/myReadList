import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normalizeState } from "../lib/core.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "theme-boot.js",
  "favicon.svg",
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
  ".nojekyll",
  "novelfire-readlist.user.js",
  "novelfire-readlist.bookmarklet.txt"
];

await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, "lib"), { recursive: true });
await mkdir(path.join(output, "data"), { recursive: true });

for (const file of files) await cp(path.join(root, file), path.join(output, file));
await cp(path.join(root, "lib", "core.js"), path.join(output, "lib", "core.js"));
await cp(path.join(root, "data", "library.json"), path.join(output, "data", "library.json"));

const index = await readFile(path.join(output, "index.html"), "utf8");
for (const required of ["Content-Security-Policy", "manifest.webmanifest", "type=\"module\"", "data/library.json"]) {
  if (!index.includes(required) && required !== "data/library.json") throw new Error(`index.html is missing ${required}`);
}

const publicState = normalizeState(JSON.parse(await readFile(path.join(output, "data", "library.json"), "utf8")));
await writeFile(path.join(output, "data", "library.json"), `${JSON.stringify(publicState, null, 2)}\n`);

console.log(`Built Novel Phoenix into ${output}`);
console.log(`Published snapshot: ${publicState.library.length} novels, ${publicState.history.length} reading events`);
