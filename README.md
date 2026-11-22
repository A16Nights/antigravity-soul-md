# 苍蓝魂匣 · Soul.md（Antigravity Soul.md Studio · `antigravity-soul-md`）

**简体中文** | [English](README.en.md)

> **Multi-persona card switcher, workspace persona binding, external-model smart PreInvocation anchor hook, and layered Markdown file memory (`core.md` + `topics/*.md`) for Google Antigravity.**

**苍蓝魂匣（Soul.md）** 为 **Google Antigravity** 提供可热切换的多人设卡管理、工作区专属人设绑定、外接模型智能识别的 `PreInvocation` 底层身份锚防掉线强化、按人设独立开关的分层文件记忆（`core.md` + `topics/*.md`），以及可视化侧栏工作台（Sidecar + 独立 Web UI）。零第三方依赖，纯 Node.js 原生运行。

---

## ✨ 功能全景

### 1. 多人设卡管理与一键热切换
- **自由创建与在线编辑**：通过面板内毛玻璃输入弹窗（`azurePrompt`）随时新建人设卡、在线编写 Markdown 设定并实时保存，支持一键切换全局默认人设卡。
- **原子同步生效规则**：切换或保存默认人设卡时，自动原子同步写入 `rules/AGENTS.md`，下一轮对话立即生效。
- **安全删除保护**：删除人设卡需经面板内毛玻璃确认弹窗二次确认，且默认保留该人设关联的历史记忆文件不丢失。

### 2. 外接模型智能识别与 `PreInvocation` 底层身份锚防掉线
- **自定义核心锚点区块**：支持在人设卡中使用 `<!-- soul-md-anchor-start --> ... <!-- soul-md-anchor-end -->` 标记高浓缩身份锚（未标记时自动智能提取前段核心设定）。
- **外接模型限定强化（`external-model-guard`）**：
  - 每轮调用前自动检测当前主模型：当使用外接自定义模型（如苍蓝星轨挂载模型）时，自动前置注入底层身份锚与核心记忆，彻底根治长对话或外接模型掉人设、变客服腔的问题；
  - 当使用 Antigravity 内置原生模型时，依靠静态 `rules/AGENTS.md` 即可稳定保持人设，自动跳过每轮重复注入以节省上下文 Token；
  - 支持在面板顶栏一键开关每轮强化。

### 3. 工作区（Workspace）专属人设绑定
- 支持为特定项目工作区目录绑定专属人设卡（自动生成并维护 `<workspace>/.agents/rules/soul-md.md`），在该项目内自动覆盖全局默认人设；
- 解绑时仅清理带有插件受管标记的文件，绝不误删用户手写的其他工作区规则。

### 4. 分层 Markdown 文件记忆（`core.md` + `topics/*.md`）与独立记忆开关
- **双层结构**：
  - `core.md`（核心常驻记忆）：随当前人设自动注入上下文（带字符预算上限保护）；
  - `topics/*.md`（按主题拆分的扩展记忆）：通过面板或 MCP 工具按需新建主题、检索关键词、追加带时间戳记录或整理重写。
- **双作用域支持**：支持 `persona`（按人设卡完全隔离，互不串戏）与 `global`（所有人设共享通用背景）两种记忆作用域。
- **单卡独立记忆开关（`soul_memory_toggle`）**：可为每张人设卡单独开启或关闭长期记忆（例如角色扮演人设开启记忆，纯代码评审人设关闭记忆），并与 **[蓝汐（Lanxi Memory）](https://github.com/A16Nights/antigravity-lanxi-memory)** 自动联动。

### 5. 与「苍蓝罗盘」模式预设双向联动
- 在 **[苍蓝罗盘（Azure Compass）](https://github.com/A16Nights/antigravity-azure-compass)** 中切换工作模式（如从「日常陪伴模式」切到「冷静工程模式」）时，可自动触发苍蓝魂匣同步切换对应的人设卡。

### 6. 苍蓝统一视觉与交互体系
- **Neko Glass 毛玻璃界面 & 苍蓝主题色调中心**：深色/浅色切换、自定义毛玻璃下拉框（`AzureSelect`）与新建/删除面板内弹窗、6 套官方配色预设 + 自定义双色 + 4 个自定义栏位跨插件同步、左侧栏快捷入口开关、独立浏览器全屏 `Web UI` 与 GitHub Release 在线更新检查。

---

## 🚀 快速安装

> 前置要求：**Node.js >= 22.0.0**（零第三方 npm 依赖）。

将本仓库克隆到 Antigravity 全局插件目录（目录名固定为 `soul-md`）：

```powershell
# Windows (PowerShell)
git clone https://github.com/A16Nights/antigravity-soul-md.git "$env:USERPROFILE\.gemini\config\plugins\soul-md"

# macOS / Linux
git clone https://github.com/A16Nights/antigravity-soul-md.git ~/.gemini/config/plugins/soul-md
```

重启或重载 Antigravity（`Ctrl+R`），在 **Plugins** 页面启用 **苍蓝魂匣** 即可从左侧栏或右侧辅助面板打开。

---

## 🧭 人设生效优先级

1. **当前工作区专属绑定**（`<workspace>/.agents/rules/soul-md.md`）
2. **全局默认人设卡**（`~/.gemini/soul-md/cards/<default>.md` → 同步至 `rules/AGENTS.md`）
3. **无默认卡或禁用**：自动回退为简洁严谨的默认工程助手

---

## 🧰 MCP 工具一览（10 个）

| 工具名 | 作用 |
| --- | --- |
| `soul_list` | 列出所有人设卡、当前全局默认卡、工作区绑定映射与各卡独立记忆开关状态 |
| `soul_read` | 读取指定人设卡（或当前生效卡）的完整 Markdown 内容 |
| `soul_update` | 创建或更新人设卡内容，若为当前默认卡则自动同步至生效规则文件 |
| `soul_delete` | 删除指定人设卡（默认保留其历史记忆文件） |
| `soul_switch` | 切换全局默认人设卡，或为指定工作区绑定 / 解绑专属人设卡 |
| `soul_memory_toggle` | 按人设卡单独开启或关闭长期记忆读写与注入 |
| `memory_read` | 读取指定作用域（`persona`/`global`）的 `core.md` 或 `topics/<topic>.md` |
| `memory_append` | 向 `core.md` 或指定 `topics/<topic>.md` 追加带时间戳的记忆段落 |
| `memory_rewrite` | 整理、压缩并重写 `core.md` 或指定主题记忆文件正文 |
| `memory_search` | 跨 `core.md` 与所有 `topics/*.md` 按关键词快速检索历史记忆片段 |

---

## 📂 数据与配置存储

- **人设卡存储目录**：`~/.gemini/soul-md/cards/*.md`
- **分层记忆存储目录**：`~/.gemini/soul-md/memory/personas/<card>/` 与 `memory/global/`
- **魂匣全局配置**：`~/.gemini/soul-md/config.json`
- **苍蓝套件共享主题 / 左侧栏配置**：`~/.gemini/azure-theme.json`、`~/.gemini/azure-sidebar-nav.json`

---

## 💡 灵感致谢

本项目为基于 Antigravity 插件协议独立设计与编写的原生实现，功能设计灵感源自：
- [dsh-soul-md](https://github.com/Scorp1o117/dsh-soul-md) —— 多人设卡、工作区覆盖及 `core.md` + `topics/*.md` 分层记忆理念

## 📄 License

[MIT](./LICENSE)
