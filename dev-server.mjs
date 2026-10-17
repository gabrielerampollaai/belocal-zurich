// Local dev server: serves public/ and the same /api routes as Vercel.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
if (fs.existsSync(path.join(here, ".env"))) process.loadEnvFile(path.join(here, ".env"));
const { MODEL, hasKey, cleanHistory, streamAnswer } = await import("./lib/concierge.mjs");

const PORT = 8000;
const STATIC = { "/": "index.html", "/index.html": "index.html", "/styles.css": "styles.css", "/app.js": "app.js" };
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" };

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/api/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: hasKey(), model: MODEL }));
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    let body = "";
    for await (const chunk of req) body += chunk;
    let history;
    try { history = cleanHistory(JSON.parse(body).messages); } catch { history = []; }
    if (!history.length) { res.writeHead(400); res.end("No message"); return; }

    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" });
    for await (const text of streamAnswer(history)) res.write(text);
    res.end();
    return;
  }

  const file = STATIC[req.url.split("?")[0]];
  if (req.method === "GET" && file) {
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] });
    fs.createReadStream(path.join(here, "public", file)).pipe(res);
    return;
  }
  res.writeHead(404); res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`beLocal running on http://localhost:${PORT}  (model: ${MODEL})`);
  if (!hasKey()) console.log("ANTHROPIC_API_KEY missing: the Concierge will use preview answers. Add it to .env");
});
