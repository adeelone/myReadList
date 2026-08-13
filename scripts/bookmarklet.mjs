import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (await readFile(path.join(root, "novelfire-readlist.js"), "utf8")).trim();
const bookmarklet = `javascript:${encodeURIComponent(source)}\n`;
await writeFile(path.join(root, "novelfire-readlist.bookmarklet.txt"), bookmarklet);
console.log("Updated novelfire-readlist.bookmarklet.txt");
