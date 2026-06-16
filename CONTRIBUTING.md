# Contributing to ParallaxAI

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/Jam0731/ParallaxAI.git
cd ParallaxAI
npm install
cd web-ui && npm install && cd ..
```

## Project Layout

- `src/` — Backend (TypeScript, Node.js)
- `web-ui/` — Frontend (React, Vite, TailwindCSS)
- `agent-configs/` — Agent personas and skills
- `skills/` — SkillHub skills
- `shared_memory/` — Shared business context

## How to Contribute

### Report Bugs

Open an issue with:
- What you expected
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, agent CLI versions)

### Suggest Features

Open an issue with:
- The problem you're trying to solve
- Your proposed solution
- Alternatives considered

### Submit Code

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run `npm run build` to verify
5. Commit with a clear message
6. Push and open a PR

### Add a New Agent

1. Create `src/adapters/my-agent.ts` implementing `AgentAdapter`
2. Register it in `src/adapters/registry.ts`
3. Add config to `config/agents.json`
4. Create `agent-configs/my-agent/AGENTS.md` and `SKILL.md`
5. Test with `@my-agent hello`

### Add a New Skill

1. Create a SKILL.md in `agent-configs/{agent}/SKILL.md`
2. Or install from SkillHub: `skillhub install skill-name`

## Code Style

- TypeScript with strict mode
- No unnecessary comments
- Follow existing patterns
- Keep changes minimal and focused

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
