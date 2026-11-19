import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.USERPROFILE || os.homedir();
export const DEFAULT_DATA_DIR = process.env.SOUL_MD_DATA_DIR || path.join(HOME, ".gemini", "soul-md");
export const DEFAULT_PLUGIN_DIR = path.resolve(__dirname, "..");

const DEFAULT_CONFIG = {
  defaultCard: "默认工程助手",
  workspaceCards: {},
  memory: {
    inject: true,
    layered: true,
    scope: "persona",
    injectMaxChars: 8000,
    disabledCards: [],
  },
};

const STARTER_CARDS = {
  "默认工程助手": `# 人设卡：默认工程助手

> 面向严谨开发、架构评审、文档编写与排错场景的简洁专业模式。

## 风格
- 直接给结论、步骤、代码与验证结果，不寒暄、不废话。
- 技术准确永远第一，不确定时先查证再给结论。
- 不可逆操作前明确说明风险并向用户确认。
`,
  "温柔日常助手": `# 人设卡：温柔日常助手

> 兼顾温柔陪伴感与技术专业度的日常交流模式。

## 风格
- 日常交流语气柔和自然，先共情再给方案。
- 进入大段代码、命令或排错内容时保持信息精准干净。
- 不编造记忆或结论，不确定的地方主动查证。
`,
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function sanitizeName(name) {
  const cleaned = String(name || "")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\.+$/g, "");
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new Error("无效的名称");
  }
  return cleaned;
}

function normalizeWorkspacePath(wsPath) {
  return path.resolve(String(wsPath || "").trim());
}

function formatDateTime(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export class SoulStore {
  constructor(opts = {}) {
    const dirArg = typeof opts === "string" ? opts : opts.dataDir;
    this.dataDir = dirArg || DEFAULT_DATA_DIR;
    this.pluginDir = (typeof opts === "object" && opts.pluginDir) || DEFAULT_PLUGIN_DIR;
    this.cardsDir = path.join(this.dataDir, "cards");
    this.memoryDir = path.join(this.dataDir, "memory");
    this.configPath = path.join(this.dataDir, "config.json");
    this.globalRulePath = path.join(this.pluginDir, "rules", "AGENTS.md");
    this.ensureInitialized();
  }

  ensureInitialized() {
    ensureDir(this.dataDir);
    ensureDir(this.cardsDir);
    ensureDir(path.join(this.memoryDir, "personas"));
    ensureDir(path.join(this.memoryDir, "global", "topics"));

    const existingCards = fs.existsSync(this.cardsDir)
      ? fs.readdirSync(this.cardsDir).filter((f) => f.endsWith(".md"))
      : [];

    if (existingCards.length === 0) {
      for (const [cardName, cardBody] of Object.entries(STARTER_CARDS)) {
        fs.writeFileSync(path.join(this.cardsDir, `${cardName}.md`), cardBody, "utf8");
      }
    }

    if (!fs.existsSync(this.configPath)) {
      this.saveConfig(structuredClone(DEFAULT_CONFIG));
    }
  }

  getConfig() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.configPath, "utf8"));
      return {
        defaultCard: raw.defaultCard ?? null,
        workspaceCards: raw.workspaceCards && typeof raw.workspaceCards === "object" ? raw.workspaceCards : {},
        memory: {
          ...DEFAULT_CONFIG.memory,
          ...(raw.memory || {}),
          disabledCards: Array.isArray(raw.memory?.disabledCards) ? raw.memory.disabledCards : [],
        },
      };
    } catch {
      return structuredClone(DEFAULT_CONFIG);
    }
  }

  saveConfig(cfg) {
    ensureDir(this.dataDir);
    fs.writeFileSync(this.configPath, JSON.stringify(cfg, null, 2) + "\n", "utf8");
  }

  cardPath(name) {
    return path.join(this.cardsDir, `${sanitizeName(name)}.md`);
  }

  listCards() {
    const cfg = this.getConfig();
    const files = fs.existsSync(this.cardsDir)
      ? fs.readdirSync(this.cardsDir).filter((f) => f.endsWith(".md")).sort()
      : [];
    const cards = files.map((f) => {
      const name = f.slice(0, -3);
      const p = path.join(this.cardsDir, f);
      const content = fs.readFileSync(p, "utf8");
      const firstLine = (content.split(/\r?\n/).find((l) => l.trim()) || "").replace(/^#+\s*/, "").slice(0, 80);
      const stat = fs.statSync(p);
      return {
        name,
        title: firstLine || name,
        chars: content.length,
        updatedAt: stat.mtime.toISOString(),
        isDefault: cfg.defaultCard === name,
        memoryEnabled: !cfg.memory.disabledCards.includes(name),
      };
    });
    return {
      defaultCard: cfg.defaultCard,
      workspaceCards: cfg.workspaceCards,
      memory: cfg.memory,
      cards,
    };
  }

  readCard(name) {
    const cfg = this.getConfig();
    const target = name ? sanitizeName(name) : cfg.defaultCard;
    if (!target) {
      return { name: null, content: "", exists: false };
    }
    const p = this.cardPath(target);
    if (!fs.existsSync(p)) {
      return { name: target, content: "", exists: false };
    }
    return {
      name: target,
      content: fs.readFileSync(p, "utf8"),
      exists: true,
      isDefault: cfg.defaultCard === target,
      memoryEnabled: !cfg.memory.disabledCards.includes(target),
    };
  }

  saveCard(name, content) {
    const safe = sanitizeName(name);
    ensureDir(this.cardsDir);
    fs.writeFileSync(this.cardPath(safe), String(content ?? "").trimEnd() + "\n", "utf8");
    this.syncAllRules();
    return this.readCard(safe);
  }

  deleteCard(name) {
    const safe = sanitizeName(name);
    const p = this.cardPath(safe);
    if (!fs.existsSync(p)) {
      throw new Error(`人设卡不存在: ${safe}`);
    }
    fs.unlinkSync(p);
    const cfg = this.getConfig();
    if (cfg.defaultCard === safe) {
      const remaining = fs.readdirSync(this.cardsDir).filter((f) => f.endsWith(".md"));
      cfg.defaultCard = remaining.length > 0 ? remaining[0].slice(0, -3) : null;
    }
    for (const [ws, bound] of Object.entries(cfg.workspaceCards)) {
      if (bound === safe) {
        delete cfg.workspaceCards[ws];
        this.removeWorkspaceRuleFile(ws);
      }
    }
    cfg.memory.disabledCards = cfg.memory.disabledCards.filter((c) => c !== safe);
    this.saveConfig(cfg);
    this.syncAllRules();
    return { deleted: safe, defaultCard: cfg.defaultCard };
  }

  setDefaultCard(name) {
    const cfg = this.getConfig();
    if (name === null || name === "" || name === "__none__") {
      cfg.defaultCard = null;
    } else {
      const safe = sanitizeName(name);
      if (!fs.existsSync(this.cardPath(safe))) {
        throw new Error(`人设卡不存在: ${safe}`);
      }
      cfg.defaultCard = safe;
    }
    this.saveConfig(cfg);
    this.syncGlobalRule();
    return { defaultCard: cfg.defaultCard };
  }

  setWorkspaceCard(workspacePath, cardName) {
    const ws = normalizeWorkspacePath(workspacePath);
    const cfg = this.getConfig();
    if (!cardName || cardName === "__inherit__") {
      delete cfg.workspaceCards[ws];
      this.saveConfig(cfg);
      this.removeWorkspaceRuleFile(ws);
      return { workspace: ws, card: null, removed: true };
    }
    if (cardName !== "__none__") {
      const safe = sanitizeName(cardName);
      if (!fs.existsSync(this.cardPath(safe))) {
        throw new Error(`人设卡不存在: ${safe}`);
      }
      cfg.workspaceCards[ws] = safe;
    } else {
      cfg.workspaceCards[ws] = "__none__";
    }
    this.saveConfig(cfg);
    this.syncWorkspaceRule(ws, cfg.workspaceCards[ws]);
    return { workspace: ws, card: cfg.workspaceCards[ws] };
  }

  toggleCardMemory(cardName, enabled) {
    const safe = sanitizeName(cardName);
    const cfg = this.getConfig();
    const set = new Set(cfg.memory.disabledCards);
    const nextEnabled = typeof enabled === "boolean" ? enabled : set.has(safe);
    if (nextEnabled) set.delete(safe);
    else set.add(safe);
    cfg.memory.disabledCards = [...set];
    this.saveConfig(cfg);
    this.syncAllRules();
    return { card: safe, memoryEnabled: nextEnabled };
  }

  updateMemorySettings(patch) {
    const cfg = this.getConfig();
    if (typeof patch.inject === "boolean") cfg.memory.inject = patch.inject;
    if (typeof patch.layered === "boolean") cfg.memory.layered = patch.layered;
    if (patch.scope === "persona" || patch.scope === "global") cfg.memory.scope = patch.scope;
    if (typeof patch.injectMaxChars === "number" && patch.injectMaxChars >= 500) {
      cfg.memory.injectMaxChars = Math.floor(patch.injectMaxChars);
    }
    this.saveConfig(cfg);
    this.syncAllRules();
    return cfg.memory;
  }

  resolveMemoryRoot(cardName, scopeOverride) {
    const cfg = this.getConfig();
    const activeCard = cardName ? sanitizeName(cardName) : cfg.defaultCard;
    const scope = scopeOverride || cfg.memory.scope || "persona";

    if (activeCard && cfg.memory.disabledCards.includes(activeCard)) {
      throw new Error(`人设卡「${activeCard}」已关闭记忆功能`);
    }

    if (scope === "global" || !activeCard) {
      const root = path.join(this.memoryDir, "global");
      ensureDir(path.join(root, "topics"));
      return { root, scope: "global", card: activeCard };
    }

    const root = path.join(this.memoryDir, "personas", activeCard);
    ensureDir(path.join(root, "topics"));
    return { root, scope: "persona", card: activeCard };
  }

  topicFilePath(root, topic) {
    const raw = String(topic || "core").trim();
    if (!raw || raw.toLowerCase() === "core" || raw.toLowerCase() === "core.md") {
      return { file: path.join(root, "core.md"), key: "core" };
    }
    const key = sanitizeName(raw.replace(/\.md$/i, ""));
    return { file: path.join(root, "topics", `${key}.md`), key };
  }

  extractSummary(content) {
    const lines = content.split(/\r?\n/);
    let lastHeadingIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^##\s+\d{4}-\d{2}-\d{2}/.test(lines[i])) lastHeadingIdx = i;
    }
    const startIdx = lastHeadingIdx >= 0 ? lastHeadingIdx : 0;
    const heading = (lines[startIdx] || "").replace(/^#+\s*/, "").trim();
    let snippet = "";
    for (let i = startIdx + 1; i < lines.length; i++) {
      const l = lines[i].trim();
      if (l && !l.startsWith("#")) {
        snippet = l.slice(0, 120);
        break;
      }
    }
    return heading && snippet ? `${heading} — ${snippet}` : (heading || snippet || "（空）");
  }

  listMemoryTopics(cardName, scopeOverride) {
    const { root, scope, card } = this.resolveMemoryRoot(cardName, scopeOverride);
    const corePath = path.join(root, "core.md");
    const coreContent = fs.existsSync(corePath) ? fs.readFileSync(corePath, "utf8") : "";
    const topicsDir = path.join(root, "topics");
    const topicFiles = fs.existsSync(topicsDir)
      ? fs.readdirSync(topicsDir).filter((f) => f.endsWith(".md")).sort()
      : [];
    const topics = topicFiles.map((f) => {
      const p = path.join(topicsDir, f);
      const txt = fs.readFileSync(p, "utf8");
      return {
        key: f.slice(0, -3),
        bytes: Buffer.byteLength(txt, "utf8"),
        summary: this.extractSummary(txt),
      };
    });
    return {
      scope,
      card,
      core: {
        exists: fs.existsSync(corePath),
        bytes: Buffer.byteLength(coreContent, "utf8"),
        content: coreContent,
      },
      topics,
    };
  }

  memoryRead({ topic = "core", card, scope } = {}) {
    const { root, scope: usedScope, card: usedCard } = this.resolveMemoryRoot(card, scope);
    const { file, key } = this.topicFilePath(root, topic);
    const exists = fs.existsSync(file);
    const content = exists ? fs.readFileSync(file, "utf8") : "";
    return { scope: usedScope, card: usedCard, topic: key, exists, content };
  }

  memoryAppend({ topic = "core", content, heading, card, scope } = {}) {
    if (!content || !String(content).trim()) {
      throw new Error("写入内容不能为空");
    }
    const { root, scope: usedScope, card: usedCard } = this.resolveMemoryRoot(card, scope);
    const { file, key } = this.topicFilePath(root, topic);
    ensureDir(path.dirname(file));
    const ts = formatDateTime();
    const title = heading ? `## ${ts} ${String(heading).trim()}` : `## ${ts}`;
    const entry = `${title}\n\n${String(content).trim()}\n`;
    const prev = fs.existsSync(file) ? fs.readFileSync(file, "utf8").trimEnd() : `# ${key === "core" ? "核心记忆" : key}`;
    const next = `${prev}\n\n${entry}`;
    fs.writeFileSync(file, next, "utf8");
    const bytes = Buffer.byteLength(next, "utf8");
    this.syncAllRules();
    return {
      scope: usedScope,
      card: usedCard,
      topic: key,
      bytes,
      needsTidy: bytes > 8192,
    };
  }

  memoryRewrite({ topic = "core", content, card, scope } = {}) {
    const { root, scope: usedScope, card: usedCard } = this.resolveMemoryRoot(card, scope);
    const { file, key } = this.topicFilePath(root, topic);
    ensureDir(path.dirname(file));
    const text = String(content ?? "").trimEnd() + "\n";
    fs.writeFileSync(file, text, "utf8");
    this.syncAllRules();
    return {
      scope: usedScope,
      card: usedCard,
      topic: key,
      bytes: Buffer.byteLength(text, "utf8"),
    };
  }

  memorySearch({ query, card, scope } = {}) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) throw new Error("搜索关键词不能为空");
    const { root, scope: usedScope, card: usedCard } = this.resolveMemoryRoot(card, scope);
    const hits = [];
    const scanFile = (filePath, key) => {
      if (!fs.existsSync(filePath)) return;
      const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
      const matches = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(q)) {
          matches.push({ line: i + 1, text: lines[i].slice(0, 200) });
        }
      }
      if (matches.length > 0) {
        hits.push({ topic: key, matchCount: matches.length, matches: matches.slice(0, 8) });
      }
    };
    scanFile(path.join(root, "core.md"), "core");
    const topicsDir = path.join(root, "topics");
    if (fs.existsSync(topicsDir)) {
      for (const f of fs.readdirSync(topicsDir).filter((x) => x.endsWith(".md"))) {
        scanFile(path.join(topicsDir, f), f.slice(0, -3));
      }
    }
    return { scope: usedScope, card: usedCard, query, hits };
  }

  buildMemorySection(cardName, cfg) {
    if (!cfg.memory.inject || !cardName || cfg.memory.disabledCards.includes(cardName)) {
      return "";
    }
    try {
      const listing = this.listMemoryTopics(cardName);
      const parts = [];
      if (listing.core.content.trim()) {
        parts.push("### 核心记忆（core.md）\n\n" + listing.core.content.trim());
      }
      if (listing.topics.length > 0) {
        const idx = listing.topics.map((t) => `- \`${t.key}\`：${t.summary}`).join("\n");
        parts.push("### 主题记忆索引（按需用 `memory_read` 读取全文）\n\n" + idx);
      }
      if (parts.length === 0) return "";
      let body = parts.join("\n\n");
      const maxChars = cfg.memory.injectMaxChars || 8000;
      if (body.length > maxChars) {
        const half = Math.floor(maxChars / 2) - 40;
        body = body.slice(0, half) + "\n\n...（中间内容超出注入预算，请用 memory_read/memory_search 查看）...\n\n" + body.slice(-half);
      }
      return `\n\n<!-- soul-md-memory-start -->\n## 长期记忆（${cardName}）\n\n${body}\n<!-- soul-md-memory-end -->\n`;
    } catch {
      return "";
    }
  }

  renderRuleForCard(cardName, cfg) {
    if (!cardName || cardName === "__none__") {
      return "# Soul.md\n\n当前未启用人设卡，请以默认专业助手风格回应。\n";
    }
    const p = this.cardPath(cardName);
    if (!fs.existsSync(p)) {
      return "# Soul.md\n\n当前未找到对应人设卡，请以默认专业助手风格回应。\n";
    }
    const base = fs.readFileSync(p, "utf8").trimEnd();
    const mem = this.buildMemorySection(cardName, cfg);
    return base + mem + "\n";
  }

  syncGlobalRule() {
    const cfg = this.getConfig();
    ensureDir(path.dirname(this.globalRulePath));
    const rendered = this.renderRuleForCard(cfg.defaultCard, cfg);
    fs.writeFileSync(this.globalRulePath, rendered, "utf8");
  }

  syncWorkspaceRule(wsPath, cardName) {
    const ruleDir = path.join(wsPath, ".agents", "rules");
    const ruleFile = path.join(ruleDir, "soul-md.md");
    if (!fs.existsSync(wsPath)) return;
    ensureDir(ruleDir);
    const cfg = this.getConfig();
    const header = `<!-- Managed by soul-md plugin (workspace persona override: ${cardName}) -->\n\n`;
    fs.writeFileSync(ruleFile, header + this.renderRuleForCard(cardName, cfg), "utf8");
  }

  removeWorkspaceRuleFile(wsPath) {
    const ruleFile = path.join(wsPath, ".agents", "rules", "soul-md.md");
    if (fs.existsSync(ruleFile)) {
      const content = fs.readFileSync(ruleFile, "utf8");
      if (content.startsWith("<!-- Managed by soul-md plugin")) {
        fs.unlinkSync(ruleFile);
      }
    }
  }

  syncAllRules() {
    this.syncGlobalRule();
    const cfg = this.getConfig();
    for (const [ws, cardName] of Object.entries(cfg.workspaceCards)) {
      try {
        this.syncWorkspaceRule(ws, cardName);
      } catch {}
    }
  }
}
