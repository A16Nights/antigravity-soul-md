// soul-md · 回合级去重（PreInvocation）
// 目标：同一用户轮次（userTurnKey = initialNumSteps）内只注入一次人设锚，
// 修复宿主不传 invocationNum 时同轮被反复注入的边界坑。
// 状态文件固定落在 ~/.gemini/soul-md/hook-state.json，绝不写入插件包目录。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "./store.mjs";

export const MAX_DEDUP_CONVERSATIONS = 64;
export const DEFAULT_HOOK_STATE_PATH = path.join(DATA_DIR, "hook-state.json");

export function resolveHookStatePath(explicit) {
  const raw = explicit || process.env.SOUL_MD_HOOK_STATE || DEFAULT_HOOK_STATE_PATH;
  return String(raw);
}

export function sha256Short(text) {
  try {
    return crypto.createHash("sha256").update(String(text ?? "")).digest("hex").slice(0, 16);
  } catch {
    return "";
  }
}

// 指纹 = 当前人设卡 | 锚点文本哈希：
// 切换人设或修改人设卡内容（锚点文本变化）都会立即失效，必须重新注入。
export function buildFingerprint(activeCard, anchorText) {
  return `${String(activeCard || "")}|${sha256Short(anchorText)}`;
}

export function normalizeTurnKey(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || typeof value === "object") return null;
  const text = String(value).trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : text;
}

export function extractTurnContext(input) {
  const src = input && typeof input === "object" ? input : {};
  const conversationId = String(src.conversationId || src.conversation_id || "").trim();
  const userTurnKey = normalizeTurnKey(src.initialNumSteps ?? src.initial_num_steps ?? null);
  const invocationNum = normalizeTurnKey(src.invocationNum ?? src.invocation_num ?? null);
  return { conversationId, userTurnKey, invocationNum };
}

function emptyState() {
  return { seq: 0, conversations: {} };
}

export function readHookState(statePath) {
  try {
    if (!fs.existsSync(statePath)) return emptyState();
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const raw = parsed && typeof parsed === "object" && parsed.conversations && typeof parsed.conversations === "object"
      ? parsed.conversations
      : {};
    const conversations = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key && value && typeof value === "object") {
        conversations[key] = value;
      }
    }
    return { seq: Number(parsed?.seq) || 0, conversations };
  } catch {
    return emptyState();
  }
}

function atomicWriteJson(filePath, payloadObj) {
  const dir = path.dirname(filePath);
  const body = JSON.stringify(payloadObj, null, 2) + "\n";
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {}
  const tmpPath = path.join(
    dir,
    `.hook-state.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
  );
  try {
    fs.writeFileSync(tmpPath, body, "utf8");
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch {
    // 回退：rename 失败时直接写目标文件，并清理临时文件
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {}
    try {
      fs.writeFileSync(filePath, body, "utf8");
      return true;
    } catch {
      return false;
    }
  }
}

export function writeHookState(statePath, state) {
  try {
    const conversations = state?.conversations && typeof state.conversations === "object" ? state.conversations : {};
    const entries = Object.entries(conversations).filter(([, v]) => v && typeof v === "object");
    let kept = Object.fromEntries(entries);
    if (entries.length > MAX_DEDUP_CONVERSATIONS) {
      entries.sort((a, b) => (Number(b[1]?.seq) || 0) - (Number(a[1]?.seq) || 0));
      kept = Object.fromEntries(entries.slice(0, MAX_DEDUP_CONVERSATIONS));
    }
    return atomicWriteJson(statePath, { seq: Number(state?.seq) || 0, conversations: kept });
  } catch {
    return false;
  }
}

// 判定是否跳过本次注入。
// 跳过条件：conversationId 非空 && userTurnKey !== null && 指纹一致 && 同一 userTurnKey
//   - invocationNum !== null 且与上次不同 -> 同轮后续工具调用，跳过
//   - invocationNum === null（宿主未传该字段）-> 只要同轮已注入过一次也跳过
export function computeTurnSkip(prev, ctx) {
  const { conversationId, userTurnKey, invocationNum, fingerprint } = ctx;
  if (!conversationId) return { skip: false, reason: "no_conversation" };
  if (userTurnKey === null || userTurnKey === undefined) return { skip: false, reason: "no_turn_key" };
  if (!prev || typeof prev !== "object") return { skip: false, reason: "first_seen" };
  if (String(prev.fingerprint || "") !== String(fingerprint || "")) {
    return { skip: false, reason: "fingerprint_changed" };
  }
  if (normalizeTurnKey(prev.userTurnKey ?? null) !== userTurnKey) {
    return { skip: false, reason: "new_turn" };
  }
  const seenCount = Math.max(0, Number(prev.seenCount) || 0);
  if (seenCount < 1) return { skip: false, reason: "not_injected_yet" };
  const prevInvocation = normalizeTurnKey(prev.invocationNum ?? null);
  if (invocationNum !== null && invocationNum !== prevInvocation) {
    return { skip: true, reason: "same_turn_followup" };
  }
  if (invocationNum === null) {
    return { skip: true, reason: "same_turn_no_invocation_num" };
  }
  return { skip: false, reason: "reinject_same_step" };
}

export function buildTurnRecord(prev, ctx) {
  const { userTurnKey, invocationNum, fingerprint, seq } = ctx;
  const sameTurn = Boolean(
    prev &&
      typeof prev === "object" &&
      String(prev.fingerprint || "") === String(fingerprint || "") &&
      normalizeTurnKey(prev.userTurnKey ?? null) === userTurnKey
  );
  const prevSeen = sameTurn ? Math.max(0, Number(prev.seenCount) || 0) : 0;
  return {
    fingerprint: String(fingerprint || ""),
    userTurnKey,
    invocationNum,
    seenCount: prevSeen + 1,
    seq: Number(seq) || 0,
    lastUpdatedAt: new Date().toISOString()
  };
}

export class TurnDedupStore {
  constructor(options = {}) {
    this.statePath = resolveHookStatePath(options.statePath);
  }

  // 只读判定，不落盘（用于"先决定是否注入，注入后再记账"的场景）
  check(input = {}, fingerprint = "") {
    try {
      const ctx = extractTurnContext(input);
      const fp = String(fingerprint || "");
      const state = readHookState(this.statePath);
      const prev = state.conversations[ctx.conversationId] || null;
      const decision = computeTurnSkip(prev, { ...ctx, fingerprint: fp });
      return { ...decision, ...ctx, fingerprint: fp };
    } catch {
      return {
        skip: false,
        reason: "state_error",
        conversationId: "",
        userTurnKey: null,
        invocationNum: null,
        fingerprint: String(fingerprint || "")
      };
    }
  }

  // 记一次成功注入
  record(input = {}, fingerprint = "") {
    try {
      const ctx = extractTurnContext(input);
      if (!ctx.conversationId || ctx.userTurnKey === null) return false;
      const fp = String(fingerprint || "");
      const state = readHookState(this.statePath);
      const prev = state.conversations[ctx.conversationId] || null;
      const seq = (Number(state.seq) || 0) + 1;
      state.seq = seq;
      state.conversations[ctx.conversationId] = buildTurnRecord(prev, { ...ctx, fingerprint: fp, seq });
      return writeHookState(this.statePath, state);
    } catch {
      return false;
    }
  }

  // 判定 + 记账一步完成（soul-md hook 使用）
  evaluate(input = {}, fingerprint = "") {
    try {
      const decision = this.check(input, fingerprint);
      if (decision.skip) return decision;
      this.record(input, fingerprint);
      return decision;
    } catch {
      return {
        skip: false,
        reason: "state_error",
        conversationId: "",
        userTurnKey: null,
        invocationNum: null,
        fingerprint: String(fingerprint || "")
      };
    }
  }
}
