# ParallaxAI

> **Multi-agent collaboration gateway for one-person companies.**
> Route messages to specialized AI agents with shared memory, session persistence, and cost tracking.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org/)

---

## What is ParallaxAI?

ParallaxAI is a **multi-agent collaboration gateway** that lets you orchestrate multiple AI agents (Claude Code, MiMo Code, Reasonix) through a single unified interface. Each agent has a distinct personality and expertise, inspired by real-world figures:

| Agent | Persona | Role | Specialty |
|-------|---------|------|-----------|
| **Munger** | Charlie Munger | Strategist | Intent routing, coordination, conflict resolution, strategic analysis |
| **Woz** | Steve Wozniak | Builder | Code implementation, architecture, deployment, system integration |
| **Ogilvy** | David Ogilvy | Growth Lead | Market research, content production, customer insights, pricing |
| **Taleb** | Nassim Taleb | Gatekeeper | Code review, cost monitoring, compliance, risk assessment |

**Key idea**: You're a one-person company. These agents are your employees, not interns. They execute autonomously with full tool access.

---

## Features

- **@mention routing** — `@woz fix the login bug` routes directly to Woz
- **Smart delegation** — Munger automatically routes tasks to the right agent
- **Shared memory** — Agents share business context across conversations
- **Session persistence** — Conversations survive page refreshes
- **Cost tracking** — Real-time token usage and cost per agent
- **Knowledge base** — FTS5 full-text search across your documents
- **Scheduled tasks** — Cron jobs for daily reports, memory consolidation
- **Web UI** — Dark-themed dashboard with chat, agent status, task boards
- **Multi-workspace** — Switch between projects seamlessly
- **Slash commands** — `/compact`, `/clear`, `/search`, `/cost`, and more

---

## Quick Start

### Prerequisites

Install at least one AI agent CLI:

```bash
# Claude Code (recommended for Woz)
npm install -g @anthropic-ai/claude-code

# MiMo Code (recommended for Munger/Ogilvy/Taleb)
# See https://mimo.xiaomi.com for installation
```

### Install ParallaxAI

```bash
git clone https://github.com/Jam0731/ParallaxAI.git
cd ParallaxAI
npm install
cd web-ui && npm install && cd ..
```

### Configure

```bash
cp .env.example .env
# Edit .env with your settings
```

### Start

```bash
./start.sh
```

Open http://localhost:45445 in your browser.

---

## Architecture

```
User ←→ Web UI (port 45445)
              │
              ▼
       Gateway (port 46446)
              │
     ┌────────┼────────────────────┐
     │   @mention router           │
     │   + Smart delegation        │
     │   + Loop detector           │
     └────────┬────────────────────┘
              │
     ┌────────▼────────┐
     │ Adapter Registry │ ← Auto-detect installed agents
     │ + Fallback Chain │
     └────────┬────────┘
              │
  ┌───────────┼───────────┬───────────┐
  ▼           ▼           ▼           ▼
Claude    MiMo Code    Reasonix    Any new
Adapter    Adapter      Adapter     Adapter
```

---

## Agent Skills

Each agent has specialized skills loaded from `agent-configs/{agent}/SKILL.md`:

### Munger (Strategist)
`brainstorm` · `plan` · `verify` · `remember` · `dream` · `schedule`

### Woz (Builder)
`tdd` · `debug` · `review` · `simplify` · `worktree` · `deploy-pilot` · `docker` · `batch`

### Ogilvy (Growth)
`brainstorm` · `review` · `report` · `market-research` · `google-trends`

### Taleb (Gatekeeper)
`debug` · `verify` · `review` · `code-review` · `security-audit` · `eslint-config-generator`

---

## Slash Commands

| Command | Description |
|---------|-------------|
| `/compact` | Summarize & compact conversation context |
| `/compact @woz` | Forward compact to a specific agent |
| `/clear` | Clear current conversation |
| `/search <query>` | Search knowledge base |
| `/cost` | Show token usage and cost |
| `/status` | Show system status |
| `/export` | Export conversation |
| `/help` | Show all commands |

---

## Configuration

### Environment Variables

```bash
# Ports
PARALLAX_PORT=46446          # Gateway WebSocket port
PARALLAX_WEB_PORT=45445      # Web UI port
PARALLAX_API_PORT=46447      # REST API port

# Paths
PARALLAX_DATA_DIR=~/.parallaxai
PARALLAX_WORKSPACE=/path/to/your/project

# Agent CLIs
CLAUDE_PATH=claude
MIMO_PATH=mimo
```

### Agent Configuration

Edit `config/agents.json` to customize agent-to-adapter mapping:

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

### Agent Personas

Edit `agent-configs/{agent}/AGENTS.md` to customize each agent's personality.
Edit `agent-configs/{agent}/SKILL.md` to customize each agent's skills.

Changes take effect on next new conversation — no restart needed.

---

## Project Structure

```
ParallaxAI/
├── src/
│   ├── index.ts              # Entry point
│   ├── gateway.ts            # WebSocket gateway
│   ├── router.ts             # @mention routing + loop detection
│   ├── context.ts            # Context management
│   ├── store.ts              # SQLite storage (15+ tables)
│   ├── workspace.ts          # Multi-workspace manager
│   ├── roles.ts              # Role CRUD API
│   ├── error-handler.ts      # Retry + circuit breaker
│   ├── adapters/
│   │   ├── claude.ts         # Claude Code adapter
│   │   ├── mimo.ts           # MiMo Code adapter
│   │   ├── reasonix.ts       # Reasonix adapter
│   │   └── registry.ts       # Auto-detect + fallback
│   ├── cost/tracker.ts       # Cost tracking + budget alerts
│   ├── knowledge/indexer.ts  # FTS5 knowledge base
│   ├── cron/scheduler.ts     # Cron job scheduler
│   └── session/
│       ├── checkpoint.ts     # Conversation persistence
│       ├── compaction.ts     # Context compaction
│       └── auto-dream.ts     # Memory consolidation
├── agent-configs/            # Agent personas + skills
│   ├── munger/
│   ├── woz/
│   ├── ogilvy/
│   └── taleb/
├── skills/                   # SkillHub skills
├── shared_memory/            # Shared business context
├── web-ui/                   # React frontend
│   └── src/
│       ├── App.tsx           # Main UI
│       ├── hooks/useGateway.ts
│       └── pages/
├── config/agents.json        # Role configuration
└── .env                      # Environment variables
```

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ways to Contribute

- **Add new agents** — Create an adapter for a new AI tool
- **Add new skills** — Write SKILL.md files for specific domains
- **Improve the UI** — Enhance the web dashboard
- **Fix bugs** — Check the issue tracker
- **Write docs** — Help others get started

---

## Roadmap

- [ ] Voice input integration
- [ ] Feishu / external channel integration
- [ ] Agent performance learning (auto-select best agent per task)
- [ ] Docker deployment
- [ ] Plugin system for custom adapters
- [ ] Mobile app

---

## License

[MIT](LICENSE) — Use it however you want.

---

## Star History

If you find ParallaxAI useful, please give it a star! It helps others discover the project.

[![Star History Chart](https://api.star-history.com/svg?repos=Jam0731/ParallaxAI&type=Date)](https://star-history.com/#Jam0731/ParallaxAI&Date)
