#!/usr/bin/env node
import readline from "node:readline";
import { SoulStore } from "./lib/store.mjs";

const store = new SoulStore();

const TOOLS = [
  {
    name: "soul_list",
    description: "列出所有人设卡、当前默认卡、工作区绑定和记忆设置。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "soul_read",
    description: "读取指定人设卡或当前默认人设卡的完整 Markdown 内容。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "人设卡名称，不填则读取当前默认人设卡" },
      },
    },
  },
  {
    name: "soul_update",
    description: "创建或更新一张人设卡的内容，并自动同步到当前生效的规则文件。",
    inputSchema: {
      type: "object",
      required: ["name", "content"],
      properties: {
        name: { type: "string", description: "人设卡名称" },
        content: { type: "string", description: "完整的人设卡 Markdown 内容" },
      },
    },
  },
  {
    name: "soul_delete",
    description: "删除指定人设卡。",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", description: "要删除的人设卡名称" },
      },
    },
  },
  {
    name: "soul_switch",
    description: "切换全局默认人设卡，或为指定工作区绑定/解绑人设卡。切换后自动更新 Antigravity 规则，下一轮对话立即生效。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "目标人设卡名称；传 '__none__' 表示禁用人设，传 '__inherit__'（仅工作区）表示取消工作区覆盖" },
        workspace: { type: "string", description: "可选：工作区绝对路径。省略则切换全局默认人设卡" },
      },
    },
  },
  {
    name: "soul_memory_toggle",
    description: "按人设卡单独开启或关闭长期文件记忆。",
    inputSchema: {
      type: "object",
      required: ["card"],
      properties: {
        card: { type: "string", description: "人设卡名称" },
        enabled: { type: "boolean", description: "true 开启，false 关闭；省略则切换状态" },
      },
    },
  },
  {
    name: "memory_read",
    description: "读取分层文件记忆（core.md 或 topics/<topic>.md），不传 topic 时返回 core.md 以及全部主题索引。",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "主题名，'core' 读取核心记忆；留空则返回 core + 所有 topics 列表" },
        card: { type: "string", description: "可选：指定人设卡名称，默认当前默认卡" },
        scope: { type: "string", enum: ["persona", "global"], description: "可选：记忆作用域" },
      },
    },
  },
  {
    name: "memory_append",
    description: "向 core 或指定 topic 追加一条带日期标题（## YYYY-MM-DD HH:mm）的记忆，并自动同步核心记忆注入。",
    inputSchema: {
      type: "object",
      required: ["content"],
      properties: {
        topic: { type: "string", description: "目标主题名，默认 'core'" },
        heading: { type: "string", description: "可选的小节简短标题" },
        content: { type: "string", description: "要记录的记忆正文" },
        card: { type: "string", description: "可选：指定人设卡名称" },
        scope: { type: "string", enum: ["persona", "global"] },
      },
    },
  },
  {
    name: "memory_rewrite",
    description: "整理并重写 core 或指定 topic 的完整 Markdown 内容（用于合并去重、更新过时结论）。",
    inputSchema: {
      type: "object",
      required: ["content"],
      properties: {
        topic: { type: "string", description: "目标主题名，默认 'core'" },
        content: { type: "string", description: "重写后的完整 Markdown 内容" },
        card: { type: "string", description: "可选：指定人设卡名称" },
        scope: { type: "string", enum: ["persona", "global"] },
      },
    },
  },
  {
    name: "memory_search",
    description: "按关键词检索 core.md 及所有 topics/*.md 记忆文件。",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "检索关键词" },
        card: { type: "string", description: "可选：指定人设卡名称" },
        scope: { type: "string", enum: ["persona", "global"] },
      },
    },
  },
];

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function sendResponse(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message, data) {
  send({ jsonrpc: "2.0", id, error: { code, message, ...(data !== undefined ? { data } : {}) } });
}

function dispatchTool(name, args = {}) {
  switch (name) {
    case "soul_list":
      return store.listCards();
    case "soul_read":
      return store.readCard(args.name);
    case "soul_update":
      return store.saveCard(args.name, args.content);
    case "soul_delete":
      return store.deleteCard(args.name);
    case "soul_switch":
      if (args.workspace) {
        return store.setWorkspaceCard(args.workspace, args.name);
      }
      return store.setDefaultCard(args.name);
    case "soul_memory_toggle":
      return store.toggleCardMemory(args.card, args.enabled);
    case "memory_read":
      if (!args.topic) {
        return store.listMemoryTopics(args.card, args.scope);
      }
      return store.memoryRead(args);
    case "memory_append":
      return store.memoryAppend(args);
    case "memory_rewrite":
      return store.memoryRewrite(args);
    case "memory_search":
      return store.memorySearch(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req;
  try {
    req = JSON.parse(trimmed);
  } catch {
    return;
  }
  const { id, method, params } = req;
  if (id === undefined || id === null) return;

  try {
    switch (method) {
      case "initialize":
        sendResponse(id, {
          protocolVersion: params?.protocolVersion || "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "soul-md", version: "2.0.0" },
        });
        break;
      case "ping":
        sendResponse(id, {});
        break;
      case "tools/list":
        sendResponse(id, { tools: TOOLS });
        break;
      case "tools/call": {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        try {
          const result = dispatchTool(toolName, toolArgs);
          sendResponse(id, {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            isError: false,
          });
        } catch (err) {
          sendResponse(id, {
            content: [{ type: "text", text: `Error (${toolName}): ${err.message || String(err)}` }],
            isError: true,
          });
        }
        break;
      }
      default:
        sendError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    sendError(id, -32603, "Internal error", String(err));
  }
});
