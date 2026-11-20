# 苍蓝魂匣 · Soul.md（Antigravity Soul.md Studio）

**简体中文** | [English](README.en.md)

> **Multi-persona card switcher, workspace persona binding, PreInvocation anti-drift anchor hook, and layered Markdown file memory (`core.md` + `topics/*.md`) for Google Antigravity.**

为 **Google Antigravity** 提供可切换的多人设卡管理、工作区专属人设覆盖、`PreInvocation` 每轮底层身份锚防掉线强化、按人设隔离的分层文件记忆，以及内置的 **苍蓝魂匣** 可视化侧栏面板。零外部依赖，纯 Node.js 原生运行。

---

## ✨ 核心特性

- **多人设卡管理与热切换**：随时新建、编辑、删除人设卡，一键切换全局默认人设，自动同步到生效规则并在下一轮对话起生效。
- **每轮 `PreInvocation` 底层身份锚防掉线**：每轮模型调用前自动注入当前人设卡的精简核心锚点（支持 `<!-- soul-md-anchor-start --> ... <!-- soul-md-anchor-end -->` 自定义区块），专治长会话与外接 API 模型掉人设问题。
- **工作区专属人设**：支持为特定项目目录绑定独立人设卡（写入 `<workspace>/.agents/rules/soul-md.md`），覆盖全局默认人设；解绑时自动清理管理文件。
- **分层文件记忆（`core.md` + `topics/*.md`）**：
  - `core.md` 常驻随当前人设注入上下文（支持字符预算保护）；
  - `topics/*.md` 按主题拆分存放，按需读取全文与关键词搜索；
  - 支持 `persona`（按人设隔离）与 `global`（全局共享）两种作用域，并且可为单张人设卡独立关闭记忆开关。
- **10 个 MCP 工具**：让 Agent 在对话中主动读取/演化人设卡与记忆。
- **可视化苍蓝魂匣（Sidecar UI）**：右侧辅助栏或浏览器全屏直观编辑人设卡、配置工作区绑定和检索分层记忆，支持暗色/亮色主题切换。

---

## 🚀 快速安装

> 前置要求：**Node.js >= 22.0.0**。

1. 克隆仓库到 Antigravity 全局插件目录：
   ```bash
   # macOS / Linux
   git clone https://github.com/A16Nights/antigravity-soul-md.git ~/.gemini/config/plugins/soul-md

   # Windows PowerShell
   git clone https://github.com/A16Nights/antigravity-soul-md.git "$env:USERPROFILE\.gemini\config\plugins\soul-md"
   ```
2. **重启 Antigravity**（彻底退出托盘后重开）。
3. 在 **Customizations** 页面启用 `Soul.md 人设工坊`，或在对话中点击 `[Soul.md 人设工坊](sidecar://soul-md/studio/)` 打开面板。

---

## 🧭 规则生效优先级

1. **工作区绑定**（`<workspace>/.agents/rules/soul-md.md`）
2. **全局默认人设卡**（同步自 `~/.gemini/soul-md/cards/<default>.md`）
3. **无默认卡或禁用**：自动回退为简洁的专业助手模式

---

## 🧰 MCP 工具一览（10 个）

| 工具名 | 作用 |
| --- | --- |
| `soul_list` | 列出所有人设卡、默认卡、工作区绑定与记忆开关状态 |
| `soul_read` | 读取指定或当前默认人设卡的完整 Markdown |
| `soul_update` | 创建或更新人设卡内容并自动同步生效规则 |
| `soul_delete` | 删除人设卡（保留其历史记忆文件） |
| `soul_switch` | 切换全局默认卡，或绑定/解绑工作区专属卡 |
| `soul_memory_toggle` | 按人设卡单独开启或关闭长期记忆 |
| `memory_read` | 读取 `core.md` 或 `topics/<topic>.md`（留空返回 `core` + 主题索引） |
| `memory_append` | 追加带时间戳小节到 `core` 或指定主题 |
| `memory_rewrite` | 整理并重写记忆文件正文 |
| `memory_search` | 跨 `core.md` 与所有 `topics/*.md` 检索关键词 |

---

## 🔒 隐私与自检

- 人设卡与分层记忆全部以纯文本 Markdown 存储在本地 `~/.gemini/soul-md/`，不联网、无遥测。
- 自检命令：`npm test`（使用隔离临时目录验证全部功能）。

---

## 💡 灵感致谢

本项目为基于 Antigravity 插件协议独立设计与编写的原生实现，功能设计灵感源自：
- [dsh-soul-md](https://github.com/Scorp1o117/dsh-soul-md) —— 多人设卡、工作区覆盖及 `core.md` + `topics/*.md` 分层记忆设计

MIT License © 2026 A16Nights
