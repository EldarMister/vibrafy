import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const indexFile = path.join(distDir, "index.html");
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolveFilePath(urlPath) {
  const normalizedPath = decodeURIComponent(urlPath.split("?")[0]);
  const relativePath =
    normalizedPath === "/" ? "/index.html" : normalizedPath;
  const absolutePath = path.normalize(path.join(distDir, relativePath));

  if (!absolutePath.startsWith(distDir)) {
    return null;
  }

  return absolutePath;
}

const server = http.createServer(async (req, res) => {
  const requestPath = resolveFilePath(req.url || "/");

  if (!requestPath) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }

  const targetPath = existsSync(requestPath) ? requestPath : indexFile;
  const extension = path.extname(targetPath);
  const contentType =
    contentTypes[extension] || "application/octet-stream";

  try {
    if (targetPath === indexFile) {
      const html = await readFile(indexFile);
      res.writeHead(200, { "Content-Type": contentType });
      res.end(html);
      return;
    }

    res.writeHead(200, { "Content-Type": contentType });
    createReadStream(targetPath).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Frontend listening on http://0.0.0.0:${port}`);
});
