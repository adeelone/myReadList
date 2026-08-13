import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPublicSnapshot, mergeSnapshot, normalizeState, parseCsv } from "../lib/core.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : "";
const outputPath = path.join(root, "data", "library.json");

if (!inputPath) {
  console.error('Usage: npm run ingest -- "C:\\path\\to\\novel-phoenix.csv"');
  process.exit(1);
}

const rows = parseCsv(await readFile(inputPath, "utf8"));
if (!rows.length) throw new Error("The CSV did not contain any readable novels.");

const current = normalizeState(JSON.parse(await readFile(outputPath, "utf8")));
const importedAt = new Date().toISOString();
const result = mergeSnapshot(current, rows, { importedAt, fileName: path.basename(inputPath) });
const publicSnapshot = createPublicSnapshot(result.state, importedAt);
await writeFile(outputPath, `${JSON.stringify(publicSnapshot, null, 2)}\n`);

console.log(`Prepared ${rows.length} novels for publication.`);
console.log(`Recorded ${result.changes} reading-progress ${result.changes === 1 ? "change" : "changes"}.`);
console.log(`Updated ${outputPath}`);
