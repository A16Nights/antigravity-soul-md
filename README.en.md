# Antigravity Soul.md Studio (Soul.md 人设工坊)

**English** | [简体中文](README.md)

> **Multi-persona card switcher, workspace persona overrides, and layered Markdown file memory (`core.md` + `topics/*.md`) for Google Antigravity.**

Bring switchable persona cards, per-workspace persona overrides, isolated per-persona layered file memory, and a visual **Soul.md Studio** side pane panel to **Google Antigravity** — built with zero external dependencies in pure Node.js.

---

## ✨ Key Features

- **Multi-Persona Cards & Instant Switching**: Create, edit, delete, and switch the active default persona card. Changes automatically sync to the active rule file and take effect on the next conversation turn.
- **Per-Workspace Persona Binding**: Assign a dedicated persona card (or disable personas) for any workspace directory by writing `<workspace>/.agents/rules/soul-md.md`; unbinding cleans up the managed rule file automatically.
- **Layered File Memory (`core.md` + `topics/*.md`)**:
  - `core.md` is injected alongside the active persona card (with configurable character budget protection).
  - `topics/*.md` stores topical memories on disk for on-demand reading and keyword search.
  - Supports both `persona` (isolated per card) and `global` scopes, plus per-card memory enable/disable toggles.
- **10 MCP Tools**: Allows the agent to inspect, evolve, and switch persona cards and memories during conversation.
- **Soul.md Studio Sidecar UI**: Visual sidecar panel (and browser full-screen view) with dark/light themes, card editor, workspace binder, and layered memory inspector.

---

## 🚀 Installation

> Prerequisite: **Node.js >= 22.0.0**.

### Option A: Git Clone (Recommended)
```bash
# macOS / Linux
git clone https://github.com/A16Nights/antigravity-soul-md.git ~/.gemini/config/plugins/soul-md

# Windows PowerShell
git clone https://github.com/A16Nights/antigravity-soul-md.git "$env:USERPROFILE\.gemini\config\plugins\soul-md"
```

### Option B: Download Release Zip
1. Download the latest `soul-md-v*.zip` from [GitHub Releases](https://github.com/A16Nights/antigravity-soul-md/releases/latest).
2. Extract it into your Antigravity plugins folder (`~/.gemini/config/plugins/` on macOS/Linux or `%USERPROFILE%\.gemini\config\plugins\` on Windows).

### Activate
Restart **Google Antigravity** completely, verify **Soul.md 人设工坊** is enabled under **Customizations**, or click `[Soul.md 人设工坊](sidecar://soul-md/studio/)` to open the Studio panel.

---

## 🧭 Persona Resolution Precedence

1. **Workspace Override** (`<workspace>/.agents/rules/soul-md.md`)
2. **Global Default Persona** (synced from `~/.gemini/soul-md/cards/<default>.md`)
3. **Disabled / None**: falls back to a concise default engineering assistant style

---

## 🧰 MCP Tools (10 Tools)

| Tool | Description |
| --- | --- |
| `soul_list` | List all persona cards, default card, workspace bindings, and memory toggles |
| `soul_read` | Read the Markdown content of a specific or default persona card |
| `soul_update` | Create or update a persona card and sync active rule files |
| `soul_delete` | Delete a persona card (existing memory files are preserved on disk) |
| `soul_switch` | Switch the global default card, or bind/unbind a workspace override (`__none__` / `__inherit__`) |
| `soul_memory_toggle` | Enable or disable layered memory per persona card |
| `memory_read` | Read `core.md` or `topics/<topic>.md` (returns `core` + topic index when `topic` is omitted) |
| `memory_append` | Append a timestamped section (`## YYYY-MM-DD HH:mm`) to `core` or a topic |
| `memory_rewrite` | Consolidate and rewrite a memory file cleanly |
| `memory_search` | Search keywords across `core.md` and all `topics/*.md` files |

---

## 🔒 Privacy & Testing

- All persona cards and memories are stored locally as plain Markdown files under `~/.gemini/soul-md/`. Zero telemetry, zero network requests.
- Run automated tests: `npm test` (verified in isolated temporary directories).

---

## 💡 Inspiration & Credits

This plugin is an independent native implementation for Google Antigravity, inspired by:
- [dsh-soul-md](https://github.com/Scorp1o117/dsh-soul-md) — multi-persona cards, workspace overrides, and `core.md` + `topics/*.md` layered file memory design

MIT License © 2026 A16Nights
