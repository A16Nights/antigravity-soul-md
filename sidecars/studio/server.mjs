import { checkGithubUpdate } from "../../lib/update-checker.mjs";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { SoulStore } from "../../lib/store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.join(__dirname, "index.html");
const store = new SoulStore();

const PORT = parseInt(
  process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || process.env.PORT || "18791",
  10
);
const TOKEN = (
  process.env.ANTIGRAVITY_SIDECAR_UI_TOKEN ||
  process.env.ANTIGRAVITY_SIDECAR_AUTH_TOKEN ||
  process.env.ANTIGRAVITY_SIDECAR_WEB_TOKEN ||
  ""
).trim();

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (c) => {
      buf += c;
      if (buf.length > 2 * 1024 * 1024) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function checkAuth(req, url) {
  if (!TOKEN) return true;
  const hdr = req.headers["x-codeium-sidecar-token"] || req.headers["x-sidecar-token"];
  const q = url.searchParams.get("token");
  return hdr === TOKEN || q === TOKEN;
}

let actualPort = PORT;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${actualPort}`);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/api/check-update") {
    const force = new URL(req.url, "http://127.0.0.1").searchParams.get("force") === "1";
    const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const info = await checkGithubUpdate({ pluginRoot, repo: "A16Nights/antigravity-soul-md", force });
    sendJson(res, 200, info);
    return;
  }

  if (pathname === "/healthz") {
    sendJson(res, 200, { ok: true, service: "soul-md-studio" });
    return;
  }

  if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (pathname.startsWith("/api/")) {
    if (!checkAuth(req, url)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }
    try {
      if (req.method === "GET" && pathname === "/api/state") {
        const webUrl = TOKEN
          ? `http://127.0.0.1:${actualPort}/?token=${encodeURIComponent(TOKEN)}`
          : `http://127.0.0.1:${actualPort}/`;
        sendJson(res, 200, { ...store.listCards(), webUrl });
        return;
      }
      if (req.method === "GET" && pathname === "/api/card") {
        const name = url.searchParams.get("name") || undefined;
        sendJson(res, 200, store.readCard(name));
        return;
      }
      if (req.method === "POST" && pathname === "/api/card") {
        const { name, content } = await readBody(req);
        sendJson(res, 200, store.saveCard(name, content));
        return;
      }
      if (req.method === "POST" && pathname === "/api/card/delete") {
        const { name } = await readBody(req);
        sendJson(res, 200, store.deleteCard(name));
        return;
      }
      if (req.method === "POST" && pathname === "/api/default") {
        const { name } = await readBody(req);
        sendJson(res, 200, store.setDefaultCard(name));
        return;
      }
      if (req.method === "POST" && pathname === "/api/workspace") {
        const { workspace, card } = await readBody(req);
        sendJson(res, 200, store.setWorkspaceCard(workspace, card));
        return;
      }
      if (req.method === "POST" && pathname === "/api/memory/toggle") {
        const { card, enabled } = await readBody(req);
        sendJson(res, 200, store.toggleCardMemory(card, enabled));
        return;
      }
      if (req.method === "POST" && pathname === "/api/memory/settings") {
        const body = await readBody(req);
        sendJson(res, 200, store.updateMemorySettings(body));
        return;
      }
      if (req.method === "GET" && pathname === "/api/memory/list") {
        const card = url.searchParams.get("card") || undefined;
        const scope = url.searchParams.get("scope") || undefined;
        sendJson(res, 200, store.listMemoryTopics(card, scope));
        return;
      }
      if (req.method === "GET" && pathname === "/api/memory/read") {
        const card = url.searchParams.get("card") || undefined;
        const scope = url.searchParams.get("scope") || undefined;
        const topic = url.searchParams.get("topic") || "core";
        sendJson(res, 200, store.memoryRead({ card, scope, topic }));
        return;
      }
      if (req.method === "POST" && pathname === "/api/memory/rewrite") {
        const body = await readBody(req);
        sendJson(res, 200, store.memoryRewrite(body));
        return;
      }
      if (req.method === "POST" && pathname === "/api/memory/append") {
        const body = await readBody(req);
        sendJson(res, 200, store.memoryAppend(body));
        return;
      }
      if (req.method === "GET" && pathname === "/api/memory/search") {
        const query = url.searchParams.get("q") || "";
        const card = url.searchParams.get("card") || undefined;
        const scope = url.searchParams.get("scope") || undefined;
        sendJson(res, 200, store.memorySearch({ query, card, scope }));
        return;
      }
      sendJson(res, 404, { error: "API route not found" });
    } catch (err) {
      sendJson(res, 400, { error: err.message || String(err) });
    }
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, "127.0.0.1", () => {
  const addr = server.address();
  if (addr && typeof addr === "object") actualPort = addr.port;
  console.log(`[soul-md studio] listening on http://127.0.0.1:${actualPort}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
