import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = process.argv[2] ? path.resolve(process.argv[2]) : "";

if (!csvPath) {
  console.error('Usage: npm run publish:snapshot -- "C:\\path\\to\\novel-phoenix.csv"');
  process.exit(1);
}

const branch = run("git", ["branch", "--show-current"], true).trim();
if (branch !== "main") throw new Error(`Snapshot publishing must run from main; current branch is ${branch || "detached"}.`);

const staged = run("git", ["diff", "--cached", "--name-only"], true).trim();
if (staged) throw new Error(`Unrelated staged changes found. Commit or unstage them first:\n${staged}`);

const existingDataChange = run("git", ["status", "--short", "--", "data/library.json"], true).trim();
if (existingDataChange) throw new Error("data/library.json already has an uncommitted change. Commit, restore, or review it before publishing another snapshot.");

run(process.execPath, [path.join(root, "scripts", "ingest.mjs"), csvPath]);
run(process.execPath, [path.join(root, "tests", "run.mjs")]);
run(process.execPath, [path.join(root, "scripts", "build.mjs")]);
run(process.execPath, ["--check", path.join(root, "novelfire-readlist.js")]);
run(process.execPath, ["--check", path.join(root, "novelfire-readlist.user.js")]);
run("git", ["add", "--", "data/library.json"]);

const changed = run("git", ["diff", "--cached", "--name-only"], true).trim();
if (!changed) {
  console.log("The public snapshot is already current; nothing was committed.");
  process.exit(0);
}

const date = new Date().toISOString().slice(0, 10);
run("git", ["commit", "-m", `update reading snapshot ${date}`]);
run("git", ["push", "origin", "main"]);
console.log("Snapshot pushed. GitHub Pages will deploy it automatically.");

function run(command, args, capture = false) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", stdio: capture ? "pipe" : "inherit", shell: false });
  if (result.status !== 0) throw new Error(result.stderr || `${command} failed with exit code ${result.status}.`);
  return result.stdout || "";
}
