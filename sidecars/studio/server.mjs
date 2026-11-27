import { checkGithubUpdate } from "../../lib/update-checker.mjs";
import { isLeftSidebarEnabled, setLeftSidebarEnabled, listOwnedPluginsNavState, registerSidecarRuntime, refreshAntigravityMcpServers, injectSidebarToggleWidget } from "../../lib/sidebar-nav.mjs";
import { handleAzureThemeHttp } from "../../lib/azure-theme.mjs";
import { injectAzureUiKit } from "../../lib/azure-ui-kit.mjs";
import { handleAzureOnboardingHttp, injectAzureOnboarding } from "../../lib/azure-onboarding.mjs";
import { SOUL_ONBOARDING_GUIDE } from "./onboarding-guide.mjs";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
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

function isAllowedLocalOrigin(req) {
  const origin = String(req.headers?.origin || "").trim();
  if (!origin || origin === "null") return true;
  try {
    const u = new URL(origin);
    const h = u.hostname.toLowerCase();
    return h === "127.0.0.1" || h === "localhost" || h === "::1" || h === "[::1]";
  } catch {
    return false;
  }
}

function safeTokenEqual(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function readBody(req, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    req.on("data", (c) => {
      if (settled) return;
      const buf = Buffer.isBuffer(c) ? c : Buffer.from(String(c), "utf8");
      total += buf.length;
      if (total > maxBytes) {
        settled = true;
        req.destroy();
        const err = new Error("Body too large");
        err.statusCode = 413;
        reject(err);
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        const err = new Error("Invalid JSON");
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on("error", (e) => {
      if (settled) return;
      settled = true;
      reject(e);
    });
  });
}

function checkAuth(req, url) {
  if (!isAllowedLocalOrigin(req)) return false;
  if (!TOKEN) return true;
  const hdr = req.headers["x-codeium-sidecar-token"] || req.headers["x-sidecar-token"];
  const q = url.searchParams.get("token");
  return safeTokenEqual(hdr, TOKEN) || safeTokenEqual(q, TOKEN);
}

let actualPort = PORT;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${actualPort}`);
  const pathname = url.pathname;

  if (pathname === "/healthz") {
    sendJson(res, 200, { ok: true, service: "soul-md-studio" });
    return;
  }

  if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(injectAzureOnboarding(injectAzureUiKit(injectSidebarToggleWidget(html, "soul-md"), "soul-md"), "soul-md", SOUL_ONBOARDING_GUIDE));
    return;
  }

  if (pathname.startsWith("/api/")) {
    if (!checkAuth(req, url)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }
    try {
      if (req.method === "GET" && pathname === "/api/check-update") {
        const force = url.searchParams.get("force") === "1";
        const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
        const info = await checkGithubUpdate({ pluginRoot, repo: "A16Nights/antigravity-soul-md", force });
        sendJson(res, 200, info);
        return;
      }
      if (await handleAzureThemeHttp(req, res)) return;
    if (await handleAzureOnboardingHttp(req, res, "soul-md", SOUL_ONBOARDING_GUIDE.version)) return;
    if (req.method === "GET" && pathname === "/api/sidebar-nav") {
        sendJson(res, 200, {
          ok: true,
          pluginId: "soul-md",
          showInLeftSidebar: isLeftSidebarEnabled("soul-md"),
          plugins: listOwnedPluginsNavState()
        });
        return;
      }
      if (req.method === "POST" && pathname === "/api/sidebar-nav") {
        const body = await readBody(req);
        const targetId = String(body.pluginId || "soul-md").trim();
        const nextVal = Boolean(body.showInLeftSidebar);
        setLeftSidebarEnabled(targetId, nextVal);
        const rf = await refreshAntigravityMcpServers();
        sendJson(res, 200, {
          ok: true,
          pluginId: targetId,
          showInLeftSidebar: nextVal,
          refreshed: Boolean(rf?.ok),
          plugins: listOwnedPluginsNavState()
        });
        return;
      }
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
      if (req.method === "POST" && pathname === "/api/anchor/settings") {
        const body = await readBody(req);
        sendJson(res, 200, store.updateAnchorSettings(body));
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
  try {
    const __a = server.address();
    const __p = (__a && typeof __a === "object" && __a.port) ? __a.port : Number(PORT) || 0;
    const __t = (process.env.ANTIGRAVITY_SIDECAR_UI_TOKEN || process.env.ANTIGRAVITY_SIDECAR_AUTH_TOKEN || process.env.ANTIGRAVITY_SIDECAR_WEB_TOKEN || "").trim();
    const __u = __t ? `http://127.0.0.1:${__p}/?token=${encodeURIComponent(__t)}` : `http://127.0.0.1:${__p}/`;
    registerSidecarRuntime("soul-md", { port: __p, url: __u });
  } catch {}
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
