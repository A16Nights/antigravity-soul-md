#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { SoulStore, CARDS_DIR } from "../lib/store.mjs";
import { TurnDedupStore, buildFingerprint } from "../lib/turn-dedup.mjs";
import { isExternalModel } from "../lib/external-model-guard.mjs";

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data.trim()));
    process.stdin.on("error", () => resolve(""));
  });
}

function buildAnchor(cardName, cardContent) {

  const lines = String(cardContent || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("<!--"));
  const summary = lines.slice(0, 8).join("\n").slice(0, 320);
  return `[Soul.md 底层身份锚 · 当前人设：${cardName}]\n${summary}`;
}

async function main() {
  const raw = await readStdin();
  let input = {};
  if (raw) {
    try {
      input = JSON.parse(raw);
    } catch {
      // ignore invalid json
    }
  }
  if (!input || typeof input !== "object") {
    input = {};
  }

  const store = new SoulStore();
  const cfg = store.getConfig();
  if (cfg.anchor && cfg.anchor.enabled === false) {
    process.stdout.write("{}\n");
    return;
  }

  // 仅对外接自定义模型生效；Antigravity 内部模型自动跳过
  if (!isExternalModel(input)) {
    process.stdout.write("{}\n");
    return;
  }

  const wsPath = input.cwd || input.workspace || input.workspacePath || "";
  let activeCard = cfg.defaultCard;
  if (wsPath && cfg.workspaceCards) {
    const resolved = path.resolve(String(wsPath));
    for (const [k, v] of Object.entries(cfg.workspaceCards)) {
      if (path.resolve(k).toLowerCase() === resolved.toLowerCase()) {
        activeCard = v;
        break;
      }
    }
  }

  if (!activeCard) {
    process.stdout.write("{}\n");
    return;
  }

  const cardPath = path.join(CARDS_DIR, `${activeCard}.md`);
  const cardContent = fs.existsSync(cardPath) ? fs.readFileSync(cardPath, "utf8") : "";
  const anchorText = buildAnchor(activeCard, cardContent);
  const fingerprint = buildFingerprint(activeCard, anchorText);

  // 回合级去重：同一用户轮次（initialNumSteps）只注入一次；
  // 切换人设 / 修改人设卡内容导致指纹变化时立即重新注入。
  // 状态读写异常一律 fail-open（照常注入），绝不抛错。
  try {
    const dedup = new TurnDedupStore();
    const decision = dedup.evaluate(input, fingerprint);
    if (decision.skip) {
      process.stdout.write("{}\n");
      return;
    }
  } catch {
    // ignore: 去重失败时继续正常注入
  }

  const output = {
    injectSteps: [
      {
        systemMessage: {
          systemMessage: anchorText
        }
      }
    ]
  };
  process.stdout.write(JSON.stringify(output) + "\n");
}

main().catch(() => {
  process.stdout.write("{}\n");
});
