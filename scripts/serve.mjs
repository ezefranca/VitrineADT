import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const directory = path.resolve(process.cwd(), process.argv[2] ?? "dist");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    const decoded = decodeURIComponent(url.pathname);
    const requestedPath = path.resolve(directory, `.${decoded === "/" ? "/index.html" : decoded}`);
    if (!requestedPath.startsWith(`${directory}${path.sep}`)) throw new Error("invalid path");
    const info = await stat(requestedPath);
    const filePath = info.isDirectory() ? path.join(requestedPath, "index.html") : requestedPath;
    response.setHeader("Content-Type", types[path.extname(filePath)] ?? "application/octet-stream");
    createReadStream(filePath).pipe(response);
  } catch {
    response.statusCode = 404;
    createReadStream(path.join(directory, "404.html")).pipe(response);
  }
});

server.listen(4173, "127.0.0.1", () => console.log("Prévia disponível em http://127.0.0.1:4173"));
