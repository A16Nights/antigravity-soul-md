import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SoulStore } from "../lib/store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

test("SoulStore persona CRUD, switching, workspace override, and layered memories", () => {
  const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), "soul-data-"));
  const tmpPlugin = fs.mkdtempSync(path.join(os.tmpdir(), "soul-plugin-"));
  const tmpWs = fs.mkdtempSync(path.join(os.tmpdir(), "soul-ws-"));

  try {
    const store = new SoulStore({ dataDir: tmpData, pluginDir: tmpPlugin });

    // Starter cards created automatically
    const initList = store.listCards();
    assert.equal(initList.defaultCard, "默认工程助手");
    assert.ok(initList.cards.some((c) => c.name === "温柔日常助手"));

    // Create & switch card
    store.saveCard("代码审查官", "# 人设卡：代码审查官\n\n- 严格检查边界条件与并发安全。\n");
    store.setDefaultCard("代码审查官");
    assert.equal(store.listCards().defaultCard, "代码审查官");
    const globalRule = fs.readFileSync(path.join(tmpPlugin, "rules", "AGENTS.md"), "utf8");
    assert.ok(globalRule.includes("严格检查边界条件"));

    // Workspace binding & unbinding
    store.setWorkspaceCard(tmpWs, "温柔日常助手");
    const wsRulePath = path.join(tmpWs, ".agents", "rules", "soul-md.md");
    assert.ok(fs.existsSync(wsRulePath));
    assert.ok(fs.readFileSync(wsRulePath, "utf8").includes("温柔日常助手"));

    store.setWorkspaceCard(tmpWs, "__inherit__");
    assert.equal(fs.existsSync(wsRulePath), false);

    // Layered memories: core.md + topics/*.md
    store.memoryAppend({ topic: "core", heading: "偏好", content: "代码注释一律使用中文。" });
    store.memoryAppend({ topic: "项目约定", heading: "测试规范", content: "必须执行单元测试后再提交。" });

    const topics = store.listMemoryTopics();
    assert.ok(topics.core.content.includes("代码注释一律使用中文"));
    assert.ok(topics.topics.some((t) => t.key === "项目约定"));

    const searchRes = store.memorySearch({ query: "单元测试" });
    assert.equal(searchRes.hits.length, 1);
    assert.equal(searchRes.hits[0].topic, "项目约定");

    // Global rule includes core.md + topic index
    const syncedRule = fs.readFileSync(path.join(tmpPlugin, "rules", "AGENTS.md"), "utf8");
    assert.ok(syncedRule.includes("代码注释一律使用中文"));
    assert.ok(syncedRule.includes("项目约定"));

    // Memory toggle off blocks memory operations
    store.toggleCardMemory("代码审查官", false);
    assert.throws(() => store.memoryRead({ topic: "core" }), /已关闭记忆功能/);
    store.toggleCardMemory("代码审查官", true);
    assert.ok(store.memoryRead({ topic: "core" }).exists);

    // Delete card
    store.deleteCard("代码审查官");
    assert.ok(!store.readCard("代码审查官").exists);
  } finally {
    fs.rmSync(tmpData, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    fs.rmSync(tmpPlugin, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    fs.rmSync(tmpWs, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
});

test("Soul.md MCP stdio server (10 tools) and Studio Sidecar HTTP server", async () => {
  const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), "soul-e2e-"));
  const env = { ...process.env, SOUL_MD_DATA_DIR: tmpData };

  try {
    // 1. MCP stdio test
    const mcpInput = [
      JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } }),
      JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "soul_list", arguments: {} } }),
    ].join("\n") + "\n";

    const mcpOut = spawnSync("node", [path.join(ROOT_DIR, "mcp-server.mjs")], {
      input: mcpInput,
      encoding: "utf8",
      env,
      timeout: 15000,
    });
    assert.equal(mcpOut.status, 0, mcpOut.stderr);
    const msgs = mcpOut.stdout.trim().split(/\r?\n/).map((l) => JSON.parse(l));
    assert.equal(msgs[1].result.tools.length, 10);
    const listRes = JSON.parse(msgs[2].result.content[0].text);
    assert.ok(listRes.cards.length >= 2);

    // 2. Sidecar HTTP Server test
    const srvProc = spawn("node", [path.join(ROOT_DIR, "sidecars", "studio", "server.mjs")], {
      env: { ...env, ANTIGRAVITY_SIDECAR_WEB_PORT: "18912" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      await new Promise((r) => setTimeout(r, 700));
      const h = await (await fetch("http://127.0.0.1:18912/healthz")).json();
      assert.equal(h.ok, true);
      const st = await (await fetch("http://127.0.0.1:18912/api/state")).json();
      assert.equal(st.defaultCard, "默认工程助手");
      const html = await (await fetch("http://127.0.0.1:18912/")).text();
      assert.ok(html.includes("Soul.md 人设工坊"));
    } finally {
      const exited = new Promise((r) => srvProc.once("exit", r));
      srvProc.kill();
      await Promise.race([exited, new Promise((r) => setTimeout(r, 1000))]);
    }
  } finally {
    fs.rmSync(tmpData, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 });
  }
});
