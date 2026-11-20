#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SoulStore } from "../lib/store.mjs";

const HOME = process.env.USERPROFILE || os.homedir();
const CARDS_DIR = path.join(HOME, ".gemini", "soul-md", "cards");

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
  const raw = String(cardContent || "");
  const customMatch = raw.match(/<!--\s*soul-md-anchor-start\s*-->([\s\S]*?)<!--\s*soul-md-anchor-end\s*-->/i);
  if (customMatch && customMatch[1].trim()) {
    return `[Soul.md 底层身份锚 · 当前人设：${cardName}]\n${customMatch[1].trim()}`;
  }

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("<!--"));
  const summary = lines.slice(0, 8).join("\n").slice(0, 360);
  return `[Soul.md 底层身份锚 · 当前人设：${cardName}]\n${summary}\n保持上述人设语气与称呼，技术准确永远第一。`;
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

  const store = new SoulStore();
  const cfg = store.getConfig();
  if (cfg.anchor && cfg.anchor.enabled === false) {
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
