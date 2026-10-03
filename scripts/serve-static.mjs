// Serves the static export in ./out the way a static host would.
// Usage: npm run build && npm run serve   (PORT=3000, NEXT_PUBLIC_BASE_PATH honoured)
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("out");
const port = Number(process.env.PORT || 3000);
const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

if (!existsSync(root)) {
  console.error("No ./out folder. Run `npm run build` first.");
  process.exit(1);
}

function fileFor(urlPath) {
  let p = decodeURIComponent(urlPath.split("?")[0]);
  if (base) {
    if (!p.startsWith(base)) return null;
    p = p.slice(base.length) || "/";
  }
  const full = normalize(join(root, p));
  if (!full.startsWith(root)) return null;
  if (existsSync(full) && statSync(full).isFile()) return full;
  if (existsSync(join(full, "index.html"))) return join(full, "index.html");
  if (existsSync(`${full}.html`)) return `${full}.html`;
  return null;
}

createServer((req, res) => {
  const file = fileFor(req.url || "/");
  if (!file) {
    const notFound = join(root, "404.html");
    res.writeHead(404, { "content-type": TYPES[".html"] });
    if (existsSync(notFound)) createReadStream(notFound).pipe(res);
    else res.end("Not found");
    return;
  }
  const type = TYPES[extname(file)] || "application/octet-stream";
  const cache = file.includes(`${join(root, "_next", "static")}`) ? "public, max-age=31536000, immutable" : "no-cache";
  res.writeHead(200, { "content-type": type, "cache-control": cache });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`Serving ./out at http://localhost:${port}${base}/`);
});
