import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetPath = path.join(root, "novelfire-readlist.bookmarklet.txt");
const source = (await readFile(path.join(root, "novelfire-readlist.js"), "utf8")).trim();
const bookmarklet = `javascript:${encodeURIComponent(source)}\n`;

if (process.argv.includes("--check")) {
  const current = await readFile(targetPath, "utf8");
  if (current !== bookmarklet) {
    console.error("novelfire-readlist.bookmarklet.txt is out of date. Run `npm run bookmarklet` and commit the result.");
    process.exit(1);
  }
  console.log("novelfire-readlist.bookmarklet.txt matches novelfire-readlist.js.");
} else {
  await writeFile(targetPath, bookmarklet);
  console.log("Updated novelfire-readlist.bookmarklet.txt");
}
