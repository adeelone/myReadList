import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// novelfire-readlist.js (the bookmarklet) is the single source of truth for the
// NovelFire extraction logic. novelfire-readlist.user.js (the Tampermonkey build)
// wraps the exact same body in a named function plus a floating launcher button,
// so it is generated from the bookmarklet source instead of hand-duplicated.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "novelfire-readlist.js");
const targetPath = path.join(root, "novelfire-readlist.user.js");

const HEADER = `// ==UserScript==
// @name         Novel Phoenix Exporter
// @namespace    local.myReadList
// @version      2.0.0
// @description  Collect library entries across all NovelFire pages, including authors and reading progress.
// @match        https://novelfire.net/account/library*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const runExtractor = () => {
`;

const FOOTER = `  };

  const addButton = () => {
    if (document.getElementById("nf-readlist-launcher")) return;
    const button = document.createElement("button");
    button.id = "nf-readlist-launcher";
    button.textContent = "Export to Novel Phoenix";
    button.style.cssText = ["position:fixed", "right:20px", "bottom:20px", "z-index:2147483646", "padding:12px 16px", "border:0", "border-radius:999px", "background:#2563eb", "color:#fff", "font:600 14px system-ui,sans-serif", "cursor:pointer", "box-shadow:0 12px 30px rgba(0,0,0,.3)"].join(";");
    button.addEventListener("click", runExtractor);
    document.body.appendChild(button);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addButton, { once: true });
  } else {
    addButton();
  }
})();
`;

function extractBody(source) {
  const lines = source.split("\n");
  if (lines[0] !== "(() => {" || lines.at(-2) !== "})();" || lines.at(-1) !== "") {
    throw new Error("novelfire-readlist.js no longer matches the expected `(() => { ... })();` wrapper.");
  }
  return lines.slice(1, -2).map((line) => (line ? `  ${line}` : line)).join("\n");
}

const source = await readFile(sourcePath, "utf8");
const generated = `${HEADER}${extractBody(source)}\n${FOOTER}`;

if (process.argv.includes("--check")) {
  const current = await readFile(targetPath, "utf8");
  if (current !== generated) {
    console.error("novelfire-readlist.user.js is out of date. Run `npm run generate` and commit the result.");
    process.exit(1);
  }
  console.log("novelfire-readlist.user.js matches novelfire-readlist.js.");
} else {
  await writeFile(targetPath, generated);
  console.log("Updated novelfire-readlist.user.js from novelfire-readlist.js.");
}
