# ParallaxAI — 项目状态文档

> 每次完成一个部分后更新此文档。用于问题定位、进度追踪、架构参考。

---

## 系统架构

```
用户 ←→ Web UI (port 45445)
              │
              ▼
       Gateway (port 46446)
              │
     ┌────────┼────────────────────────┐
     │   @mention router               │
     │   + Munger smart router          │
     │   + Loop detector                │
     └────────┬────────────────────────┘
              │
     ┌────────▼────────┐
     │ Adapter Registry │ ← 启动时自动检测
     │ + Fallback Chain │
     └────────┬────────┘
              │
  ┌───────────┼───────────┬───────────┐
  ▼           ▼           ▼           ▼
Claude    MiMo Code    Reasonix    (扩展)
Adapter    Adapter      Adapter
  │           │           │
  ▼           ▼           ▼
claude       mimo      reasonix
 -p/--resume  run --pure  acp
```

## Agent 角色

| Agent | 人格原型 | 默认 Adapter | 定位 |
|-------|---------|-------------|------|
| **Munger** | 查理·芒格 | MiMo Code | 参谋长：路由、判断、裁决、战略 |
| **Woz** | 沃兹尼亚克 | Claude Code | 构建者：代码、部署、集成 |
| **Ogilvy** | 大卫·奥格威 | MiMo Code | 增长者：市场、客户、内容 |
| **Taleb** | 纳西姆·塔勒布 | MiMo Code | 守门人：风险、质量、成本 |

## 路由规则

- `@woz xxx` → 直接发给 Woz → Woz 直接回复用户
- `@ogilvy xxx` → 直接发给 Ogilvy
- `@taleb xxx` → 直接发给 Taleb
- `@munger xxx` → Munger 处理
- 无 @mention → 默认发给 Munger（智能路由）
- Munger 回复含 `@agent` → 自动触发委派

## Session 持久化

| Agent | 创建 Session | 恢复 Session |
|-------|-------------|-------------|
| Claude Code | `claude -p "msg" --session-id <uuid>` | `echo "msg" \| claude --resume <uuid>` |
| MiMo Code | `mimo run "msg" --format json --pure` | `mimo run "msg" -s <session-id> --pure` |
| Reasonix | ACP `session/new` | ACP `session/prompt` |

**关键发现**：
- Claude Code 的 `--acp` 是编译时特性，当前版本不可用
- MiMo Code 必须用 `--pure` 否则进程不退出
- MiMo Code 必须用 `stdio: ["ignore", "pipe", "pipe"]` 否则 stdin pipe 导致挂起
- MiMo Code 必须设置 `MIMOCODE_CLIENT=parallax` 环境变量
- Claude Code 的 `stream-json` 需要 `--verbose` 参数
- Claude Code 的 assistant 事件和 result 事件都会包含文本，需要去重

## 端口配置

| 服务 | 端口 |
|------|------|
| Gateway WebSocket | 46446 |
| Web UI | 45445 |
| OpenClaw Gateway | 18789（不修改） |

---

## 完成状态

### Phase 1：基础架构 ✅

| 组件 | 文件 | 状态 | 说明 |
|------|------|------|------|
| 类型定义 | `src/types.ts` | ✅ | 253 行，覆盖所有接口 |
| SQLite 存储 | `src/store.ts` | ✅ | 295 行，10 张表 |
| WebSocket 网关 | `src/gateway.ts` | ✅ | 305 行，完整协议 |
| @mention 路由 | `src/router.ts` | ✅ | 79 行，含循环防护 |
| 上下文管理 | `src/context.ts` | ✅ | 101 行，skill + 共享记忆注入 |
| 入口 | `src/index.ts` | ✅ | 80 行，启动 + 检测 |
| ACP 连接 | `src/adapters/acp-connection.ts` | ✅ | 124 行，NDJSON 协议 |
| ACP 基类 | `src/adapters/acp-adapter.ts` | ✅ | 197 行，session 管理 |
| Claude Adapter | `src/adapters/claude.ts` | ✅ | 132 行，`-p` + `--resume` |
| MiMo Adapter | `src/adapters/mimo.ts` | ✅ | 154 行，`--pure` + `-s` |
| Reasonix Adapter | `src/adapters/reasonix.ts` | ✅ | 13 行，ACP 模式 |
| Adapter Registry | `src/adapters/registry.ts` | ✅ | 172 行，自动检测 + Fallback |
| Agent Skills | `skills/*/SKILL.md` | ✅ | 4 个文件 |
| 共享记忆 | `shared_memory/*.json` | ✅ | 7 个文件 |
| Agent 配置 | `config/agents.json` | ✅ | 角色 + adapter 映射 |

**验证结果**：
- `@woz say hello` → Claude Code 响应 ✅
- `what is 2+2` → Munger (MiMo) 响应 "4" ✅
- 连续对话保持上下文 ✅
- 端口 46446 正常监听 ✅

### Phase 2：Web UI ✅ 基础完成

| 组件 | 文件 | 状态 | 说明 |
|------|------|------|------|
| React + Vite 项目 | `web-ui/` | ✅ | React + TypeScript + TailwindCSS |
| 聊天界面 | `web-ui/src/App.tsx` | ✅ | 消息列表 + 输入框 + 侧边栏 |
| WebSocket Hook | `web-ui/src/hooks/useGateway.ts` | ✅ | 连接管理 + 消息收发 |
| @mention 自动补全 | `web-ui/src/App.tsx` | ✅ | 输入 @ 弹出 agent 列表 |
| Agent 状态面板 | `web-ui/src/App.tsx` | ✅ | 侧边栏显示 agent 状态 |
| 流式渲染 | `web-ui/src/hooks/useGateway.ts` | ✅ | 流式显示 agent 回复 |

**验证结果**：
- Gateway port 46446 正常监听 ✅
- Web UI port 45445 正常监听 ✅
- 构建通过 ✅

### Phase 3：记忆系统 ✅ 基础完成

| 组件 | 文件 | 状态 | 说明 |
|------|------|------|------|
| Memory Service (FTS5) | `src/memory/service.ts` | ✅ | 83 行，文件索引 + BM25 搜索 |
| FTS5 虚拟表 | `src/store.ts` | ✅ | memory_fts + 触发器自动同步 |
| Checkpoint 系统 | `src/session/checkpoint.ts` | ✅ | 74 行，持久化对话状态 |
| Context Compaction | `src/session/compaction.ts` | ✅ | 130 行，4 级压力检测 + 压缩 |
| 对话分支 | `src/session/branch.ts` | ✅ | 102 行，git-style 分支 + 合并 |

**验证结果**：
- 构建通过 ✅
- FTS5 搜索可用 ✅

### Phase 4：高级功能 ⬜ 未开始

| 组件 | 状态 | 说明 |
|------|------|------|
| Auto-Dream | ⬜ | 每 7 天记忆收敛 |
| 成本追踪 | ⬜ | 每 agent API 成本 |
| 知识库 | ⬜ | 文档索引 |
| 定时任务 | ⬜ | 每日简报等 |
| 备份/恢复 | ⬜ | 一键导出导入 |
| 语音输入 | ⬜ | /voice 命令 |

---

## 已知问题

| 问题 | 严重度 | 说明 |
|------|--------|------|
| MiMo `-s` 恢复 session 可能挂起 | 中 | 需要进一步测试 `-s` 标志在 gateway 环境中的行为 |
| Claude Code `--resume` 需要 stdin pipe | 低 | 已通过 `stdin.write + end` 解决 |
| Reasonix ACP 未完整测试 | 低 | 基类可用，需要实际验证 |

## 源码参考

| 项目 | 路径 | 用途 |
|------|------|------|
| OpenClaw | `~/workspace/agent-consortium/openclaw-main/` | 插件系统、gateway 设计参考 |
| MiMo Code | `~/workspace/agent-consortium/MiMo-Code/` | 上下文管理、记忆系统参考 |
| Claude Code | `~/workspace/agent-consortium/claude-code/` | ACP 协议、session 管理参考 |
| Reasonix | `~/workspace/agent-consortium/Reasonix/` | ACP 实现、事件系统参考 |

---

- **2026-06-14** Phase 3 基础完成。Memory Service (FTS5) + Checkpoint + Context Compaction + 对话分支。

---

## 项目统计

```
src/                    2294 行 TypeScript
├── types.ts            253 行
├── store.ts            350 行
├── gateway.ts          305 行
├── router.ts           79 行
├── context.ts          101 行
├── index.ts            80 行
├── adapters/           792 行
│   ├── acp-connection.ts 124 行
│   ├── acp-adapter.ts    197 行
│   ├── claude.ts         132 行
│   ├── mimo.ts           154 行
│   ├── reasonix.ts       13 行
│   └── registry.ts       172 行
├── memory/             83 行
│   └── service.ts        83 行
└── session/            306 行
    ├── checkpoint.ts     74 行
    ├── compaction.ts     130 行
    └── branch.ts         102 行

web-ui/                 ~300 行 TypeScript/React
├── src/App.tsx         ~200 行
└── src/hooks/          ~100 行
```

- **2026-06-14** Phase 1 完成。网关 + 双 agent 验证通过。端口改为 46446/45445。
- **2026-06-14** Phase 2 基础完成。Web UI 搭建完成，聊天界面 + @mention 自动补全 + Agent 状态面板。
- **2026-06-14** Phase 3 基础完成。Memory Service (FTS5) + Checkpoint + Context Compaction + 对话分支。

---

## 待补全模块

| 模块 | 预估行数 | 优先级 | 状态 | 说明 |
|------|---------|--------|------|------|
| 错误恢复 + 重试 | 300 | 高 | ✅ | `src/error-handler.ts`，含熔断器 |
| 成本追踪 + 预算告警 | 400 | 高 | ✅ | `src/cost/tracker.ts`，含预算告警 |
| 知识库索引 | 500 | 中 | ✅ | `src/knowledge/indexer.ts`，FTS5 搜索 + 分块索引 |
| 定时任务调度 | 300 | 中 | ✅ | `src/cron/scheduler.ts`，支持 interval |
| 备份/恢复 | 200 | 低 | ✅ | `src/backup/export-import.ts` |
| Auto-Dream 记忆收敛 | 300 | 中 | ✅ | `src/session/auto-dream.ts`，7 天周期 |
| Web UI 完善 | 2000 | 中 | ✅ | Agent 状态、任务看板、@mention 自动补全 |
| 测试 | 1000 | 中 | ⬜ | 单元 + 集成测试 |

- **2026-06-14** Phase 4 补全。知识库索引完成。总代码 3218 行。
- **2026-06-14** Web UI 完善。添加 Agent 状态面板、任务看板、@mention 自动补全。前端 379 行。

- **2026-06-14** Bug 修复：Skill 注入生效。Munger 现在知道自己是查理·芒格，能正确委派任务给其他 agent。回复元数据清理完成。

- **2026-06-14** 全面集成完成。所有模块接入主流程：错误恢复、成本追踪、检查点、Auto-Dream、知识库、Cron。Session 映射持久化到 SQLite。总代码 3301 行。

- **2026-06-16** 10 项优化完成：
  1. 会话切换自动加载工作区（session_mappings 存 workspace_id）
  2. @mention 键盘导航（ArrowUp/Down/Enter/Escape）
  3. Auto-Dream 工作区级隔离 + 智能摘要压缩（替代 200 行限制）
  4. 知识库搜索 Skill 注入（4 个 SKILL.md + REST API）
  5. 委派任务看板（独立页面，4 列看板）
  6. 成本追踪实时显示（底部状态栏 token/成本）
  7. 知识库 API（/api/knowledge/search + /api/knowledge/stats）
  8. 定时任务看板（独立页面，任务列表 + 运行历史表格）
  9. 全局 UI 优化（暗色滚动条 + 选区颜色）
  10. 斜杠命令（/clear, /help, /cost, /export, /new, /munger, /woz, /ogilvy, /taleb）
