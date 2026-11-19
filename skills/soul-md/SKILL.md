---
name: soul-md
description: >-
  Manage multiple persona cards, switch active global or workspace personas, and
  read/append/rewrite/search per-persona layered file memories (core.md + topics/*.md)
  via the soul-md MCP tools and Soul.md Studio sidecar panel. Use when the user asks
  to list, create, edit, switch, or bind persona cards, or manage persona memories.
---

# Soul.md 人设工坊与分层记忆

本插件提供多人设卡切换、工作区人设绑定、分层文件记忆以及右侧可视化面板（`[Soul.md 人设工坊](sidecar://soul-md/studio/)`）。

## 数据目录
- 人设卡：`~/.gemini/soul-md/cards/<name>.md`
- 配置文件：`~/.gemini/soul-md/config.json`
- 分层记忆：`~/.gemini/soul-md/memory/personas/<name>/core.md` 与 `topics/*.md`（全局作用域在 `memory/global/`）

## 可用 MCP 工具（`soul-md`）
- `soul_list`：列出所有人设卡、当前默认卡、工作区绑定与记忆开关状态
- `soul_read(name?)`：读取指定或当前默认人设卡内容
- `soul_update(name, content)`：创建或更新人设卡，并自动同步生效规则
- `soul_delete(name)`：删除指定人设卡
- `soul_switch(name, workspace?)`：切换全局默认人设卡，或为指定工作区绑定/解绑专属人设（传 `__none__` 禁用，工作区传 `__inherit__` 取消覆盖）
- `soul_memory_toggle(card, enabled?)`：按人设卡单独开启或关闭长期记忆
- `memory_read(topic?, card?, scope?)`：读取 `core.md` 或 `topics/<topic>.md`；不传 `topic` 返回 `core` 和全部主题索引
- `memory_append(content, topic?, heading?, card?, scope?)`：追加带时间标题的记忆条目
- `memory_rewrite(content, topic?, card?, scope?)`：整理并重写记忆文件
- `memory_search(query, card?, scope?)`：按关键词搜索所有记忆文件

## 规则生效顺序
1. 工作区绑定（自动写入 `<workspace>/.agents/rules/soul-md.md`）
2. 全局默认人设卡（自动同步到本插件 `rules/AGENTS.md`）
3. 切换人设卡或更新 `core.md` 后会自动重写对应规则文件，在下一轮对话立即生效。
