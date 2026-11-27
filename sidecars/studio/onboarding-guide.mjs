export const SOUL_ONBOARDING_GUIDE = {
  version: "1",
  icon: "💎",
  title: "欢迎使用苍蓝魂匣——人设卡与分层记忆",
  subtitle: "1 分钟了解多人设热切换、工作区绑定、外接模型防掉线与分层记忆（随时点顶栏「? 指南」重看）",
  steps: [
    {
      icon: "🪪",
      navTitle: "管理人设卡",
      title: "创建、编辑并一键切换多张人设卡",
      desc: "可以把不同性格、沟通风格或专业角色分别做成独立人设卡，随时点击切换，立即生效。",
      spotlight: {
        clickBefore: '.tab[data-tab="cards"]',
        selector: "#cards-list",
        buttonText: "定位人设列表",
        hint: "左侧挑选或新建人设卡，右侧直接编辑 Markdown 正文并一键设为当前生效人设"
      },
      items: [
        {
          icon: "⚡",
          title: "全局热切换不丢原文",
          text: "切换人设时自动同步写入生效规则，支持实时预览与随时回切，多角色互不串味。"
        },
        {
          icon: "⚓",
          title: "外接模型防掉线锚点",
          text: "顶部勾选「外接模型锚点强化」后，使用外部自定义模型也能在长对话里稳住语气不漂移。"
        }
      ],
      tip: "开启锚点强化时会自动跳过原生 Gemini 模型，只对外接模型精准生效，避免冗余注入。"
    },
    {
      icon: "📁",
      navTitle: "工作区专属绑定",
      title: "不同项目目录自动启用不同人设",
      desc: "想在代码项目里用冷静严谨的工程师风格、在日常目录里用轻松陪伴的风格？绑好工作区就能自动切换。",
      spotlight: {
        clickBefore: '.tab[data-tab="workspaces"]',
        selector: "#ws-list",
        buttonText: "定位工作区绑定",
        hint: "填好工作区路径并指定对应人设卡，打开该目录时会自动优先套用专属人设"
      },
      items: [
        {
          icon: "🔀",
          title: "项目级优先级覆盖",
          text: "命中绑定的工作区自动使用专属人设，未绑定的目录自动回落到全局默认人设。"
        }
      ],
      tip: "绑定关系随时可修改或解绑，不需要重启 Antigravity。"
    },
    {
      icon: "📖",
      navTitle: "分层文件记忆",
      title: "每张人设卡拥有独立的长短记忆文件",
      desc: "每张人设卡都配有一份核心记忆（core.md）和多份主题记忆（topics/*.md），纯文本透明可控。",
      spotlight: {
        clickBefore: '.tab[data-tab="memory"]',
        selector: "#mem-editor",
        buttonText: "定位记忆编辑区",
        hint: "支持关键词检索记忆、切换 core 与专题文件，随时手动修改或清空"
      },
      items: [
        {
          icon: "🗂️",
          title: "核心记忆 + 专题记忆分层",
          text: "常驻重要信息放 core.md，具体话题放 topics/*.md，对话时按需读取既省上下文又记牢细节。"
        },
        {
          icon: "🔎",
          title: "跨文件即时检索",
          text: "在记忆页输入关键词即可快速查到对应人设保存过的所有片段。"
        }
      ],
      tip: "随时可点顶栏「? 指南」重看本教程；支持键盘 ← / → 翻页与 Esc 关闭。"
    }
  ]
};
