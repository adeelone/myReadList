import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number.parseInt(process.env.PORT || "4173", 10);
const types = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".txt": "text/plain", ".webmanifest": "application/manifest+json", ".xml": "application/xml" };

createServer((request, response) => {
  const requested = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
  const directFile = path.resolve(root, relative);
  const cleanFile = path.resolve(root, `${relative}.html`);
  const inRoot = (file) => file.startsWith(`${root}${path.sep}`);
  const file = inRoot(directFile) && statSafe(directFile) ? directFile : inRoot(cleanFile) && statSafe(cleanFile) ? cleanFile : path.join(root, "404.html");
  const status = file.endsWith(`${path.sep}404.html`) ? 404 : 200;
  response.writeHead(status, { "Content-Type": `${types[path.extname(file)] || "application/octet-stream"}; charset=utf-8`, "Cache-Control": "no-store" });
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => console.log(`Novel Phoenix: http://127.0.0.1:${port}`));

function statSafe(file) { try { return statSync(file).isFile(); } catch (_) { return false; } }
