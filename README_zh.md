# ParallaxAI

> **一人公司的多 Agent 协作网关。**
> 将消息路由到专业 AI Agent，支持共享记忆、会话持久化和成本追踪。

[English](README.md) | **中文**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org/)

---

## ParallaxAI 是什么？

ParallaxAI 是一个**多 Agent 协作网关**，让你通过一个统一界面编排多个 AI Agent（Claude Code、MiMo Code、Reasonix）。每个 Agent 有独特的人格和专长，灵感来自真实人物：

| Agent | 人格原型 | 角色 | 专长 |
|-------|---------|------|------|
| **Munger** | 查理·芒格 | 参谋长 | 意图路由、协调、冲突裁决、战略分析 |
| **Woz** | 沃兹尼亚克 | 构建者 | 代码实现、架构设计、部署、系统集成 |
| **Ogilvy** | 大卫·奥格威 | 增长者 | 市场调研、内容生产、客户洞察、定价策略 |
| **Taleb** | 纳西姆·塔勒布 | 守门人 | 代码审查、成本监控、合规检查、风险评估 |

**核心理念**：你是一人公司，这些 Agent 是你的员工，不是实习生。它们自主执行，拥有完整的工具权限。

---

## 功能特性

- **@mention 路由** — `@woz 修一下登录 bug` 直接路由给 Woz
- **智能委派** — Munger 自动将任务路由给合适的 Agent
- **共享记忆** — Agent 之间共享业务上下文
- **会话持久化** — 刷新页面不丢失对话
- **成本追踪** — 实时显示每个 Agent 的 token 消耗和费用
- **知识库** — FTS5 全文搜索，跨文档检索
- **定时任务** — Cron 调度，每日简报、记忆收敛
- **Web UI** — 暗色主题面板：聊天、Agent 状态、任务看板
- **多工作区** — 无缝切换不同项目
- **斜杠命令** — `/compact`、`/clear`、`/search`、`/cost` 等

---

## 快速开始

### 前置条件

安装至少一个 AI Agent CLI：

```bash
# Claude Code（推荐用于 Woz）
npm install -g @anthropic-ai/claude-code

# MiMo Code（推荐用于 Munger/Ogilvy/Taleb）
# 参见 https://mimo.xiaomi.com
```

### 安装 ParallaxAI

```bash
git clone https://github.com/Jam0731/ParallaxAI.git
cd ParallaxAI
npm install
cd web-ui && npm install && cd ..
```

### 配置

```bash
cp .env.example .env
# 编辑 .env 设置你的配置
```

### 启动

```bash
./start.sh
```

在浏览器打开 http://localhost:45445

---

## 系统架构

```
用户 ←→ Web UI (端口 45445)
              │
              ▼
       Gateway (端口 46446)
              │
     ┌────────┼────────────────────┐
     │   @mention 路由             │
     │   + 智能委派                │
     │   + 循环检测                │
     └────────┬────────────────────┘
              │
     ┌────────▼────────┐
     │ 适配器注册表     │ ← 自动检测已安装的 Agent
     │ + 降级链         │
     └────────┬────────┘
              │
  ┌───────────┼───────────┬───────────┐
  ▼           ▼           ▼           ▼
Claude    MiMo Code    Reasonix    任意新
适配器      适配器       适配器      适配器
```

---

## Agent 技能

每个 Agent 有专属技能，从 `agent-configs/{agent}/SKILL.md` 加载：

### Munger（参谋长）
`brainstorm` · `plan` · `verify` · `remember` · `dream` · `schedule`

### Woz（构建者）
`tdd` · `debug` · `review` · `simplify` · `worktree` · `deploy-pilot` · `docker` · `batch`

### Ogilvy（增长者）
`brainstorm` · `review` · `report` · `market-research` · `google-trends`

### Taleb（守门人）
`debug` · `verify` · `review` · `code-review` · `security-audit` · `eslint-config-generator`

---

## 斜杠命令

| 命令 | 说明 |
|------|------|
| `/compact` | 压缩对话上下文 |
| `/compact @woz` | 将压缩转发给指定 Agent |
| `/clear` | 清空当前会话 |
| `/search <关键词>` | 搜索知识库 |
| `/cost` | 显示 token 消耗和费用 |
| `/status` | 显示系统状态 |
| `/export` | 导出对话 |
| `/help` | 显示所有命令 |

---

## 配置说明

### 环境变量

```bash
# 端口
PARALLAX_PORT=46446          # Gateway WebSocket 端口
PARALLAX_WEB_PORT=45445      # Web UI 端口
PARALLAX_API_PORT=46447      # REST API 端口

# 路径
PARALLAX_DATA_DIR=~/.parallaxai
PARALLAX_WORKSPACE=/home/user/my-project

# Agent CLI（自动检测）
CLAUDE_PATH=claude
MIMO_PATH=mimo
```

### Agent 配置

编辑 `config/agents.json` 自定义 Agent 到适配器的映射：

```json
{
  "roles": {
    "munger": { "preferred": "mimo", "fallback": ["claude"] },
    "woz": { "preferred": "claude", "fallback": ["mimo"] },
    "ogilvy": { "preferred": "mimo", "fallback": ["claude"] },
    "taleb": { "preferred": "mimo", "fallback": ["claude"] }
  }
}
```

### Agent 人格和技能

- 编辑 `agent-configs/{agent}/AGENTS.md` 自定义人格
- 编辑 `agent-configs/{agent}/SKILL.md` 自定义技能

修改后新会话自动生效，无需重启。

---

## 项目结构

```
ParallaxAI/
├── src/
│   ├── index.ts              # 入口
│   ├── gateway.ts            # WebSocket 网关
│   ├── router.ts             # @mention 路由 + 循环检测
│   ├── context.ts            # 上下文管理
│   ├── store.ts              # SQLite 存储（15+ 张表）
│   ├── workspace.ts          # 多工作区管理
│   ├── roles.ts              # 角色 CRUD API
│   ├── adapters/
│   │   ├── claude.ts         # Claude Code 适配器
│   │   ├── mimo.ts           # MiMo Code 适配器
│   │   └── registry.ts       # 自动检测 + 降级
│   ├── cost/tracker.ts       # 成本追踪 + 预算告警
│   ├── knowledge/indexer.ts  # FTS5 知识库
│   └── session/
│       ├── checkpoint.ts     # 会话持久化
│       └── auto-dream.ts     # 记忆收敛
├── agent-configs/            # Agent 人格 + 技能
├── skills/                   # SkillHub 技能
├── shared_memory/            # 共享业务上下文
├── web-ui/                   # React 前端
└── config/agents.json        # 角色配置
```

---

## 参与贡献

欢迎贡献！详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

### 贡献方式

- **添加新 Agent** — 为新 AI 工具编写适配器
- **添加新技能** — 编写 SKILL.md 定义特定领域的技能
- **改进 UI** — 增强 Web 面板
- **修复 Bug** — 查看 Issue 列表
- **编写文档** — 帮助其他人上手

---

## 路线图

- [ ] 语音输入集成
- [ ] 飞书 / 外部渠道集成
- [ ] Agent 性能学习（自动选择最佳 Agent）
- [ ] Docker 部署
- [ ] 插件系统
- [ ] 移动端 App

---

## 许可证

[MIT](LICENSE) — 随便用。

---

## Star 历史

如果你觉得 ParallaxAI 有用，请给个 Star！帮助更多人发现这个项目。

[![Star History Chart](https://api.star-history.com/svg?repos=Jam0731/ParallaxAI&type=Date)](https://star-history.com/#Jam0731/ParallaxAI&Date)
