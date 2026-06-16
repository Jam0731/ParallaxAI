# ParallaxAI Optimization & Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 10 optimization and feature items for ParallaxAI gateway and web UI.

**Architecture:** Backend changes in `src/` (gateway, store, context, auto-dream), frontend changes in `web-ui/src/` (App.tsx, hooks/useGateway.ts, new page components). Knowledge base integration via SKILL.md files.

**Tech Stack:** TypeScript, React, Vite, TailwindCSS, SQLite (better-sqlite3), WebSocket

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/store.ts` | Modify | Add `workspace_id` to session_mappings, add cost summary API |
| `src/gateway.ts` | Modify | Session workspace auto-switch, slash commands, cost_update forwarding, delegation task API |
| `src/context.ts` | Modify | Auto-Dream memory path per workspace |
| `src/session/auto-dream.ts` | Modify | Smart summary compression, workspace-scoped memory |
| `src/types.ts` | Modify | Add slash command types |
| `web-ui/src/App.tsx` | Modify | Major rewrite: @mention keyboard nav, slash commands, cost bar, task boards, scrollbar styling |
| `web-ui/src/hooks/useGateway.ts` | Modify | Cost tracking state, delegation tasks state, slash commands, workspace auto-switch on conversation switch |
| `web-ui/src/pages/CostPanel.tsx` | Create | Cost dashboard component |
| `web-ui/src/pages/DelegationBoard.tsx` | Create | Delegation task board |
| `web-ui/src/pages/CronBoard.tsx` | Create | Cron task board |
| `web-ui/src/index.css` | Modify | Scrollbar styling, global dark theme polish |
| `skills/*/SKILL.md` | Modify | Add knowledge_search instructions |

---

## Task 1: Session Workspace Auto-Load

**Covers:** Item 1 — 会话切换自动加载项目目录

**Files:**
- Modify: `src/store.ts` — add `workspace_id` column to session_mappings
- Modify: `src/gateway.ts` — save workspace_id with session, auto-switch on conversation switch
- Modify: `web-ui/src/hooks/useGateway.ts` — send workspace_switch when loading conversation

- [ ] **Step 1: Add workspace_id to session_mappings**

In `src/store.ts`, add to the `migrate()` method after the session_mappings CREATE TABLE:

```typescript
this.safeAddColumn("session_mappings", "workspace_id", "TEXT")
```

Update `saveSessionMapping` signature to accept `workspaceId`:

```typescript
saveSessionMapping(agentId: string, conversationId: string, sessionId: string, adapterId: string, contextHash?: string, workspaceId?: string): void {
  const now = Date.now()
  this.db.prepare(
    `INSERT INTO session_mappings (agent_id, conversation_id, session_id, adapter_id, context_hash, workspace_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(agent_id, conversation_id) DO UPDATE SET
       session_id = excluded.session_id, adapter_id = excluded.adapter_id, 
       context_hash = excluded.context_hash, workspace_id = excluded.workspace_id, updated_at = excluded.updated_at`
  ).run(agentId, conversationId, sessionId, adapterId, contextHash ?? null, workspaceId ?? null, now, now)
}
```

Add method to get workspace for a conversation:

```typescript
getConversationWorkspace(conversationId: string): string | undefined {
  const row = this.db.prepare(
    "SELECT workspace_id FROM session_mappings WHERE conversation_id = ? AND workspace_id IS NOT NULL LIMIT 1"
  ).get(conversationId) as any
  return row?.workspace_id ?? undefined
}
```

- [ ] **Step 2: Save workspace_id when saving session**

In `src/gateway.ts`, line ~241, update the `saveSessionMapping` call:

```typescript
if (result.sessionId) {
  this.store.saveSessionMapping(agentId, conversationId, result.sessionId, result.adapterId, currentHash, this.workspaceManager.getActiveId())
}
```

- [ ] **Step 3: Auto-switch workspace on conversation load**

In `src/gateway.ts`, add a new message type handler for `conversation_select` in `handleClientMessage`:

```typescript
case "conversation_select":
  {
    const convId = msg.conversationId
    // Check if this conversation has a workspace association
    const wsId = this.store.getConversationWorkspace(convId)
    if (wsId && wsId !== this.workspaceManager.getActiveId()) {
      const ws = this.workspaceManager.switchTo(wsId)
      if (ws) {
        this.sendToClient(clientId, { type: "workspace_active", workspace: ws } as any)
      }
    }
    // Send conversation history
    const messages = this.store.getMessages(convId)
    this.sendToClient(clientId, { type: "conversation_history", conversationId: convId, messages } as any)
  }
  break
```

- [ ] **Step 4: Frontend uses conversation_select**

In `web-ui/src/hooks/useGateway.ts`, update `switchConversation`:

```typescript
const switchConversation = useCallback((id: string) => {
  setConversationId(id)
  setMessages([])
  setStreaming(null)
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(JSON.stringify({ type: 'conversation_select', conversationId: id }))
  }
}, [])
```

- [ ] **Step 5: Verify**

Run: `cd /home/jam/workspace/ParallaxAI && npm run build`
Expected: Build succeeds with no type errors.

---

## Task 2: @mention Keyboard Navigation

**Covers:** Item 2 — @mention 键盘上下选择

**Files:**
- Modify: `web-ui/src/App.tsx` — add selectedIndex state + keyboard handler

- [ ] **Step 1: Add selectedIndex state**

In `web-ui/src/App.tsx`, add after the existing mention states (line ~29):

```typescript
const [mentionIndex, setMentionIndex] = useState(0)
```

- [ ] **Step 2: Reset index when filter changes**

Update the `handleInputChange` function to reset index when mention filter changes:

```typescript
const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const val = e.target.value
  setInput(val)
  const cursorPos = e.target.selectionStart
  const beforeCursor = val.slice(0, cursorPos)
  const mentionMatch = beforeCursor.match(/@(\w*)$/)
  if (mentionMatch) {
    setShowMentions(true)
    setMentionFilter(mentionMatch[1].toLowerCase())
    setMentionIndex(0)
  } else {
    setShowMentions(false)
  }
}
```

- [ ] **Step 3: Add keyboard handling to input**

Update `handleKeyDown` to handle ArrowUp, ArrowDown, Enter when mentions are shown:

```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (showMentions && filteredAgents.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionIndex(i => Math.min(i + 1, filteredAgents.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionIndex(i => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const [id] = filteredAgents[mentionIndex]
      if (id) insertMention(id)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setShowMentions(false)
      return
    }
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}
```

- [ ] **Step 4: Highlight selected item in dropdown**

Update the mention dropdown rendering to highlight `mentionIndex`:

```typescript
{showMentions && filteredAgents.length > 0 && (
  <div className="absolute bottom-full left-4 mb-1 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-lg z-10">
    {filteredAgents.map(([id, agent], idx) => (
      <button
        key={id}
        onClick={() => insertMention(id)}
        className={`w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-2 ${
          idx === mentionIndex ? 'bg-gray-700 text-white' : ''
        }`}
      >
        <span>{agent.emoji}</span>
        <span className="text-sm text-gray-200">@{id}</span>
        <span className="text-xs text-gray-500 ml-auto">{agent.role}</span>
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 5: Verify**

Run: `cd /home/jam/workspace/ParallaxAI && npm run build`
Expected: Build succeeds.

---

## Task 3: Auto-Dream Workspace-Scoped Memory + Smart Compression

**Covers:** Item 3 — Auto-Dream 记忆范围 + 智能摘要压缩

**Files:**
- Modify: `src/session/auto-dream.ts` — workspace-scoped paths, smart compression
- Modify: `src/gateway.ts` — pass workspace context to auto-dream
- Modify: `src/index.ts` — pass workspace info to auto-dream

- [ ] **Step 1: Update AutoDream constructor to accept workspaceId**

In `src/session/auto-dream.ts`, update the class:

```typescript
export class AutoDream {
  constructor(
    private store: Store,
    private dataDir: string,
  ) {}

  getMemoryDir(workspaceId?: string): string {
    if (workspaceId) {
      return join(this.dataDir, "workspaces", workspaceId, "memory")
    }
    return join(this.dataDir, "memory")
  }

  shouldRun(workspaceId?: string): boolean {
    const last = this.getLastDreamRun()
    if (!last) return true
    return Date.now() - last.completedAt > DREAM_INTERVAL_DAYS * 86_400_000
  }

  async run(workspaceId?: string): Promise<DreamResult> {
    const start = Date.now()
    const memoryDir = this.getMemoryDir(workspaceId)
    mkdirSync(memoryDir, { recursive: true })

    const sources = this.gatherSources(memoryDir)
    const consolidated = this.consolidate(sources)
    const perfInsights = this.analyzePerformance()

    const memoryPath = join(memoryDir, "MEMORY.md")
    const existing = existsSync(memoryPath) ? readFileSync(memoryPath, "utf-8") : ""
    const newContent = this.mergeMemory(existing, consolidated.text, perfInsights)
    writeFileSync(memoryPath, newContent, "utf-8")

    // Smart compression: summarize if too long instead of hard prune
    const compressed = await this.smartCompress(memoryPath)

    this.recordDreamRun(start, consolidated.added, consolidated.merged, compressed)
    return {
      entriesAdded: consolidated.added,
      entriesMerged: consolidated.merged,
      entriesPruned: compressed,
      durationMs: Date.now() - start,
    }
  }
```

- [ ] **Step 2: Replace pruneMemory with smartCompress**

Replace the `pruneMemory` method with `smartCompress`:

```typescript
private async smartCompress(path: string): Promise<number> {
  const content = readFileSync(path, "utf-8")
  const lines = content.split("\n")
  if (lines.length <= 200) return 0

  // Group lines by section (## headers)
  const sections: Array<{ header: string; lines: string[] }> = []
  let current = { header: "", lines: [] as string[] }

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current.header || current.lines.length > 0) sections.push(current)
      current = { header: line, lines: [] }
    } else {
      current.lines.push(line)
    }
  }
  if (current.header || current.lines.length > 0) sections.push(current)

  // Keep the most recent sections, summarize older ones
  const MAX_SECTIONS = 20
  if (sections.length <= MAX_SECTIONS) return 0

  const recent = sections.slice(-MAX_SECTIONS)
  const older = sections.slice(0, -MAX_SECTIONS)

  // Create a summary of older sections
  const summaryLines = [
    `## Consolidated History (${older.length} older sections, ${new Date().toISOString()})`,
    ...older.flatMap(s => {
      const meaningful = s.lines.filter(l => l.trim().length > 10 && !l.startsWith("#"))
      return meaningful.length > 0 ? [`- ${s.header.replace("## ", "")}: ${meaningful[0].slice(0, 100)}`] : []
    })
  ]

  const compressed = [...summaryLines, "", ...recent.flatMap(s => [s.header, ...s.lines])].join("\n")
  writeFileSync(path, compressed, "utf-8")
  return lines.length - compressed.split("\n").length
}
```

- [ ] **Step 3: Update gatherSources to use memoryDir param**

```typescript
private gatherSources(memoryDir: string): Array<{ path: string; content: string }> {
  const sources: Array<{ path: string; content: string }> = []
  if (!existsSync(memoryDir)) return sources

  const scan = (dir: string) => {
    try {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry)
        if (entry.endsWith(".md") || entry.endsWith(".json")) {
          try {
            sources.push({ path: fullPath, content: readFileSync(fullPath, "utf-8") })
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  }

  scan(memoryDir)
  return sources
}
```

- [ ] **Step 4: Update index.ts to pass workspace context**

In `src/index.ts`, update auto-dream initialization (line ~84):

```typescript
const autoDream = new AutoDream(store, DATA_DIR)
const activeWsId = store.getMostRecentWorkspace()?.id
if (autoDream.shouldRun(activeWsId)) {
  console.log("\n💤 Auto-Dream: running memory consolidation...")
  const result = await autoDream.run(activeWsId)
  console.log(`   Added: ${result.entriesAdded}, Merged: ${result.entriesMerged}, Pruned: ${result.entriesPruned}`)
}
```

- [ ] **Step 5: Verify**

Run: `cd /home/jam/workspace/ParallaxAI && npm run build`
Expected: Build succeeds.

---

## Task 4: Knowledge Base Skill Integration

**Covers:** Item 7 — 知识库工具注入

**Files:**
- Modify: `skills/munger/SKILL.md` — add knowledge search instructions
- Modify: `skills/woz/SKILL.md` — add knowledge search instructions
- Modify: `skills/ogilvy/SKILL.md` — add knowledge search instructions
- Modify: `skills/taleb/SKILL.md` — add knowledge search instructions

- [ ] **Step 1: Create knowledge search skill section**

Add the following section to each agent's SKILL.md (append at the end):

```markdown
## 知识库搜索

当需要查找项目文档、历史记录、业务数据时，使用以下方法搜索知识库：

### 搜索命令
在终端运行：
\`\`\`bash
curl -s "http://localhost:46447/api/knowledge/search?q=你的查询关键词&limit=5"
\`\`\`

返回 JSON 数组，每项包含：
- `title`: 文档标题
- `chunkContent`: 匹配的文本片段
- `score`: 相关度分数

### 使用场景
- 查找项目文档中的特定信息
- 搜索历史对话中的决策记录
- 查找业务数据和配置信息
- 在编码时搜索相关技术文档

### 注意事项
- 知识库索引了 `shared_memory/` 目录下的所有文档
- 支持的格式：`.md`, `.txt`, `.json`, `.yaml`, `.ts`, `.js`
- 搜索使用 FTS5 全文索引，支持中英文混合搜索
```

- [ ] **Step 2: Add knowledge search API endpoint**

In `src/index.ts`, add the knowledge search endpoint to the Express app (after the roles router):

```typescript
app.get("/api/knowledge/search", (req, res) => {
  const query = req.query.q as string
  const limit = parseInt(req.query.limit as string) || 5
  if (!query) {
    res.status(400).json({ error: "Missing query parameter 'q'" })
    return
  }
  const results = knowledgeIndexer.query({ query, limit })
  res.json(results)
})

app.get("/api/knowledge/stats", (req, res) => {
  res.json(knowledgeIndexer.getStats())
})
```

- [ ] **Step 3: Update each SKILL.md file**

Read each SKILL.md and append the knowledge search section.

- [ ] **Step 4: Verify**

Run: `cd /home/jam/workspace/ParallaxAI && npm run build`
Expected: Build succeeds.

Test the API:
Run: `curl -s "http://localhost:46447/api/knowledge/stats"`
Expected: JSON with `documents` and `chunks` counts.

---

## Task 5: Delegation Task Board

**Covers:** Item 5 — 委派任务追踪看板

**Files:**
- Create: `web-ui/src/pages/DelegationBoard.tsx`
- Modify: `web-ui/src/App.tsx` — replace Task Board tab
- Modify: `web-ui/src/hooks/useGateway.ts` — add delegation task state
- Modify: `src/gateway.ts` — add delegation_tasks API via WebSocket

- [ ] **Step 1: Add delegation task query to store**

In `src/store.ts`, add method:

```typescript
listDelegatedTasks(limit = 50): Array<{ id: string; conversationId: string; delegatingAgent: string; targetAgent: string; task: string; status: string; result?: string; createdAt: number; completedAt?: number }> {
  return this.db.prepare(
    "SELECT id, conversation_id, delegating_agent, target_agent, task, status, result, created_at, completed_at FROM delegated_tasks ORDER BY created_at DESC LIMIT ?"
  ).all(limit) as any[]
}
```

- [ ] **Step 2: Add WebSocket handler for delegation_tasks**

In `src/gateway.ts`, add to `handleClientMessage`:

```typescript
case "delegation_tasks":
  {
    const tasks = this.store.listDelegatedTasks(msg.limit ?? 50)
    this.sendToClient(clientId, { type: "delegation_tasks", tasks } as any)
  }
  break
```

- [ ] **Step 3: Create DelegationBoard component**

Create `web-ui/src/pages/DelegationBoard.tsx`:

```tsx
import { useEffect } from 'react'

type DelegationTask = {
  id: string
  conversationId: string
  delegatingAgent: string
  targetAgent: string
  task: string
  status: string
  result?: string
  createdAt: number
  completedAt?: number
}

const AGENT_EMOJI: Record<string, string> = {
  munger: '🧠', woz: '🔧', ogilvy: '📢', taleb: '🛡️'
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/50 text-yellow-300 border-yellow-800',
  running: 'bg-blue-900/50 text-blue-300 border-blue-800',
  completed: 'bg-green-900/50 text-green-300 border-green-800',
  needs_decision: 'bg-purple-900/50 text-purple-300 border-purple-800',
}

const COLUMNS = ['pending', 'running', 'completed', 'needs_decision'] as const

export default function DelegationBoard({ tasks, onRefresh }: { tasks: DelegationTask[]; onRefresh: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Delegation Tasks</h2>
        <button onClick={onRefresh} className="px-3 py-1.5 bg-gray-800 rounded hover:bg-gray-700 text-xs text-gray-300">
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map(status => {
          const columnTasks = tasks.filter(t => t.status === status)
          return (
            <div key={status} className="bg-gray-900 rounded-lg p-3 border border-gray-800 min-h-[200px]">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-3 capitalize flex items-center justify-between">
                <span>{status.replace('_', ' ')}</span>
                <span className="bg-gray-800 px-2 py-0.5 rounded-full">{columnTasks.length}</span>
              </div>
              <div className="space-y-2">
                {columnTasks.length === 0 ? (
                  <div className="text-xs text-gray-600 italic py-4 text-center">No tasks</div>
                ) : (
                  columnTasks.map(task => (
                    <div key={task.id} className="bg-gray-800 rounded p-3 border border-gray-700">
                      <div className="flex items-center gap-2 mb-2">
                        <span>{AGENT_EMOJI[task.delegatingAgent] ?? '👤'}</span>
                        <span className="text-xs text-gray-400">→</span>
                        <span>{AGENT_EMOJI[task.targetAgent] ?? '👤'}</span>
                        <span className="text-xs text-gray-500 ml-auto">
                          {new Date(task.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-sm text-gray-300 line-clamp-3">{task.task}</div>
                      {task.result && (
                        <div className="mt-2 text-xs text-gray-500 line-clamp-2 border-t border-gray-700 pt-2">
                          {task.result}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add delegation tasks to useGateway hook**

In `web-ui/src/hooks/useGateway.ts`, add state and handler:

```typescript
const [delegationTasks, setDelegationTasks] = useState<any[]>([])
```

In the `handleMessage` switch, add:

```typescript
case 'delegation_tasks':
  if (msg.tasks) setDelegationTasks(msg.tasks as any[])
  break
```

Add a refresh function:

```typescript
const refreshDelegationTasks = useCallback(() => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(JSON.stringify({ type: 'delegation_tasks' }))
  }
}, [])
```

Return it from the hook:

```typescript
return { 
  connected, messages, agents, streaming, send, cancel,
  workspaces, activeWorkspace, conversationId, conversations,
  switchWorkspace, createWorkspace, newConversation, switchConversation,
  delegationTasks, refreshDelegationTasks, costSummary, // add costSummary later
}
```

- [ ] **Step 5: Replace Task Board in App.tsx**

Import and use DelegationBoard:

```tsx
import DelegationBoard from './pages/DelegationBoard'
```

Replace the tasks tab content:

```tsx
{activeTab === 'tasks' && (
  <DelegationBoard tasks={delegationTasks} onRefresh={refreshDelegationTasks} />
)}
```

- [ ] **Step 6: Verify**

Run: `cd /home/jam/workspace/ParallaxAI && npm run build`
Expected: Build succeeds.

---

## Task 6: Cron Task Board

**Covers:** Item 8 — 定时任务看板

**Files:**
- Create: `web-ui/src/pages/CronBoard.tsx`
- Modify: `web-ui/src/App.tsx` — add cron tab
- Modify: `web-ui/src/hooks/useGateway.ts` — add cron state
- Modify: `src/gateway.ts` — add cron WebSocket handlers

- [ ] **Step 1: Add cron query methods to store**

In `src/store.ts`, add:

```typescript
listCronJobs(): Array<{ id: string; name: string; description?: string; scheduleType: string; scheduleValue: string; targetAgent?: string; enabled: boolean; lastRunAt?: number; lastStatus?: string; consecutiveFailures: number }> {
  return this.db.prepare(
    "SELECT id, name, description, schedule_type, schedule_value, target_agent, enabled, last_run_at, last_status, consecutive_failures FROM cron_jobs ORDER BY created_at ASC"
  ).all() as any[]
}

listCronRuns(jobId?: string, limit = 20): Array<{ id: string; jobId: string; startedAt: number; completedAt?: number; status: string; output?: string; error?: string }> {
  let sql = "SELECT id, job_id, started_at, completed_at, status, output, error FROM cron_runs"
  const params: any[] = []
  if (jobId) { sql += " WHERE job_id = ?"; params.push(jobId) }
  sql += " ORDER BY started_at DESC LIMIT ?"
  params.push(limit)
  return this.db.prepare(sql).all(...params) as any[]
}
```

- [ ] **Step 2: Add WebSocket handlers for cron data**

In `src/gateway.ts`, add to `handleClientMessage`:

```typescript
case "cron_jobs":
  {
    const jobs = this.store.listCronJobs()
    this.sendToClient(clientId, { type: "cron_jobs", jobs } as any)
  }
  break
case "cron_runs":
  {
    const runs = this.store.listCronRuns(msg.jobId, msg.limit)
    this.sendToClient(clientId, { type: "cron_runs", runs } as any)
  }
  break
```

- [ ] **Step 3: Create CronBoard component**

Create `web-ui/src/pages/CronBoard.tsx`:

```tsx
import { useState } from 'react'

type CronJob = {
  id: string
  name: string
  description?: string
  scheduleType: string
  scheduleValue: string
  targetAgent?: string
  enabled: boolean
  lastRunAt?: number
  lastStatus?: string
  consecutiveFailures: number
}

type CronRun = {
  id: string
  jobId: string
  startedAt: number
  completedAt?: number
  status: string
  output?: string
  error?: string
}

const AGENT_EMOJI: Record<string, string> = {
  munger: '🧠', woz: '🔧', ogilvy: '📢', taleb: '🛡️'
}

export default function CronBoard({ jobs, runs, onRefresh }: { jobs: CronJob[]; runs: CronRun[]; onRefresh: () => void }) {
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const filteredRuns = selectedJob ? runs.filter(r => r.jobId === selectedJob) : runs

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Scheduled Tasks</h2>
        <button onClick={onRefresh} className="px-3 py-1.5 bg-gray-800 rounded hover:bg-gray-700 text-xs text-gray-300">
          Refresh
        </button>
      </div>

      {/* Jobs List */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {jobs.length === 0 ? (
          <div className="col-span-2 text-center text-gray-600 py-8">No scheduled tasks</div>
        ) : (
          jobs.map(job => (
            <button
              key={job.id}
              onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
              className={`bg-gray-900 rounded-lg p-4 border text-left transition-colors ${
                selectedJob === job.id ? 'border-blue-500' : 'border-gray-800 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${job.enabled ? 'bg-green-400' : 'bg-gray-600'}`} />
                <span className="text-white font-medium text-sm">{job.name}</span>
                {job.targetAgent && <span>{AGENT_EMOJI[job.targetAgent] ?? '👤'}</span>}
              </div>
              {job.description && <div className="text-xs text-gray-500 mb-2">{job.description}</div>}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{job.scheduleType}: {job.scheduleValue}</span>
                {job.lastRunAt && (
                  <span>Last: {new Date(job.lastRunAt).toLocaleString()} ({job.lastStatus})</span>
                )}
                {job.consecutiveFailures > 0 && (
                  <span className="text-red-400">{job.consecutiveFailures} failures</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Runs History */}
      <h3 className="text-lg font-semibold text-white mb-3">Run History{selectedJob ? ` (filtered)` : ''}</h3>
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
              <th className="px-4 py-2 text-left">Job</th>
              <th className="px-4 py-2 text-left">Started</th>
              <th className="px-4 py-2 text-left">Duration</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Output</th>
            </tr>
          </thead>
          <tbody>
            {filteredRuns.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-600">No runs yet</td></tr>
            ) : (
              filteredRuns.map(run => {
                const job = jobs.find(j => j.id === run.jobId)
                const duration = run.completedAt ? `${((run.completedAt - run.startedAt) / 1000).toFixed(1)}s` : '-'
                return (
                  <tr key={run.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2 text-gray-300">{job?.name ?? run.jobId}</td>
                    <td className="px-4 py-2 text-gray-400">{new Date(run.startedAt).toLocaleString()}</td>
                    <td className="px-4 py-2 text-gray-400">{duration}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        run.status === 'success' ? 'bg-green-900/50 text-green-300' :
                        run.status === 'failed' ? 'bg-red-900/50 text-red-300' :
                        'bg-yellow-900/50 text-yellow-300'
                      }`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-xs max-w-xs truncate">{run.output ?? run.error ?? '-'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add cron state to useGateway**

In `web-ui/src/hooks/useGateway.ts`:

```typescript
const [cronJobs, setCronJobs] = useState<any[]>([])
const [cronRuns, setCronRuns] = useState<any[]>([])
```

In handleMessage:

```typescript
case 'cron_jobs':
  if (msg.jobs) setCronJobs(msg.jobs as any[])
  break
case 'cron_runs':
  if (msg.runs) setCronRuns(msg.runs as any[])
  break
```

Add refresh:

```typescript
const refreshCronData = useCallback(() => {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(JSON.stringify({ type: 'cron_jobs' }))
    wsRef.current.send(JSON.stringify({ type: 'cron_runs' }))
  }
}, [])
```

- [ ] **Step 5: Add Cron tab to App.tsx**

Change the tab type to include 'cron':

```typescript
const [activeTab, setActiveTab] = useState<'chat' | 'agents' | 'roles' | 'tasks' | 'cron'>('chat')
```

Add the cron tab button:

```tsx
{(['chat', 'agents', 'roles', 'tasks', 'cron'] as const).map(tab => (
```

Add cron panel:

```tsx
{activeTab === 'cron' && (
  <CronBoard jobs={cronJobs} runs={cronRuns} onRefresh={refreshCronData} />
)}
```

- [ ] **Step 6: Verify**

Run: `cd /home/jam/workspace/ParallaxAI && npm run build`
Expected: Build succeeds.

---

## Task 7: Cost Tracking UI

**Covers:** Item 6 — 成本追踪实时显示

**Files:**
- Modify: `web-ui/src/hooks/useGateway.ts` — add cost summary state
- Modify: `web-ui/src/App.tsx` — add bottom status bar with cost display
- Modify: `src/gateway.ts` — add cost_summary WebSocket handler

- [ ] **Step 1: Add cost summary query to store**

In `src/store.ts`, add:

```typescript
getCostSummaryByAgent(): Array<{ agentId: string; totalUsd: number; totalTokens: number; messageCount: number }> {
  return this.db.prepare(
    `SELECT agent_id, COALESCE(SUM(cost_usd), 0) as total_usd, 
     COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
     COUNT(*) as message_count
     FROM cost_entries GROUP BY agent_id`
  ).all() as any[]
}

getTodayCost(): { totalUsd: number; totalTokens: number } {
  const row = this.db.prepare(
    `SELECT COALESCE(SUM(cost_usd), 0) as total_usd, 
     COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens
     FROM cost_entries WHERE created_at > unixepoch() * 1000 - 86400000`
  ).get() as any
  return { totalUsd: row?.total_usd ?? 0, totalTokens: row?.total_tokens ?? 0 }
}
```

- [ ] **Step 2: Add cost_summary WebSocket handler**

In `src/gateway.ts`, add to `handleClientMessage`:

```typescript
case "cost_summary":
  {
    const summary = this.store.getTodayCost()
    const byAgent = this.store.getCostSummaryByAgent()
    this.sendToClient(clientId, { type: "cost_summary", today: summary, byAgent } as any)
  }
  break
```

Also forward `cost_update` messages to all clients. The existing code already sends `cost_update` to the conversation subscribers (line 285-289). We need to also send it globally so the status bar updates:

In `executeAgentTurn`, after the existing `cost_update` send, add:

```typescript
this.broadcastAll({ type: "cost_update", agentId, cost: costEntry })
```

- [ ] **Step 3: Add cost state to useGateway**

In `web-ui/src/hooks/useGateway.ts`:

```typescript
const [costSummary, setCostSummary] = useState<{ today: { totalUsd: number; totalTokens: number }; byAgent: Record<string, { usd: number; tokens: number }> }>({ today: { totalUsd: 0, totalTokens: 0 }, byAgent: {} })
```

In handleMessage, handle cost_update to accumulate:

```typescript
case 'cost_update':
  if (msg.cost) {
    setCostSummary(prev => ({
      ...prev,
      today: {
        totalUsd: prev.today.totalUsd + (msg.cost?.costUsd ?? 0),
        totalTokens: prev.today.totalTokens + ((msg.cost?.inputTokens ?? 0) + (msg.cost?.outputTokens ?? 0)),
      }
    }))
  }
  break

case 'cost_summary':
  if (msg.today) setCostSummary({ today: msg.today, byAgent: msg.byAgent ?? {} })
  break
```

On connect, request cost summary:

```typescript
ws.send(JSON.stringify({ type: 'cost_summary' }))
```

- [ ] **Step 4: Add bottom status bar to App.tsx**

Add a status bar at the bottom of the main content area. In the main content div, after the chat/agents/roles/tasks panels:

```tsx
{/* Bottom Status Bar */}
<div className="h-8 bg-gray-900/80 border-t border-gray-800 flex items-center px-4 gap-6 text-xs text-gray-500">
  <div className="flex items-center gap-4">
    {Object.entries(AGENTS).map(([id, agent]) => (
      <div key={id} className="flex items-center gap-1">
        <span>{agent.emoji}</span>
        <span className={agents[id] === 'idle' ? 'text-green-400' : agents[id] === 'busy' ? 'text-yellow-400' : 'text-gray-600'}>
          {agents[id] ?? 'offline'}
        </span>
      </div>
    ))}
  </div>
  <div className="flex-1" />
  <div className="flex items-center gap-4">
    <span>Tokens: {(costSummary.today.totalTokens).toLocaleString()}</span>
    <span>Cost: ${costSummary.today.totalUsd.toFixed(4)}</span>
  </div>
</div>
```

- [ ] **Step 5: Verify**

Run: `cd /home/jam/workspace/ParallaxAI && npm run build`
Expected: Build succeeds.

---

## Task 8: Slash Commands (Global Shared)

**Covers:** Item 10 — 斜杠命令

**Files:**
- Modify: `web-ui/src/App.tsx` — slash command detection + dropdown
- Modify: `web-ui/src/hooks/useGateway.ts` — slash command handlers
- Modify: `src/gateway.ts` — handle built-in slash commands

- [ ] **Step 1: Define global slash commands**

In `web-ui/src/App.tsx`, add the command definitions:

```typescript
const SLASH_COMMANDS = [
  { name: '/clear', description: 'Clear current conversation', icon: '🗑️' },
  { name: '/help', description: 'Show available commands', icon: '❓' },
  { name: '/cost', description: 'Show cost summary', icon: '💰' },
  { name: '/export', description: 'Export conversation', icon: '📤' },
  { name: '/new', description: 'New conversation', icon: '🆕' },
  { name: '/munger', description: 'Switch to Munger', icon: '🧠' },
  { name: '/woz', description: 'Switch to Woz', icon: '🔧' },
  { name: '/ogilvy', description: 'Switch to Ogilvy', icon: '📢' },
  { name: '/taleb', description: 'Switch to Taleb', icon: '🛡️' },
]
```

- [ ] **Step 2: Add slash command state + detection**

In `web-ui/src/App.tsx`, add states:

```typescript
const [showCommands, setShowCommands] = useState(false)
const [commandFilter, setCommandFilter] = useState('')
const [commandIndex, setCommandIndex] = useState(0)
```

Update `handleInputChange` to detect `/`:

```typescript
const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  const val = e.target.value
  setInput(val)
  const cursorPos = e.target.selectionStart
  const beforeCursor = val.slice(0, cursorPos)
  
  // Check for @mention
  const mentionMatch = beforeCursor.match(/@(\w*)$/)
  if (mentionMatch) {
    setShowMentions(true)
    setMentionFilter(mentionMatch[1].toLowerCase())
    setMentionIndex(0)
    setShowCommands(false)
    return
  }
  
  // Check for /command
  const commandMatch = beforeCursor.match(/^\/(\w*)$/)
  if (commandMatch) {
    setShowCommands(true)
    setCommandFilter(commandMatch[1].toLowerCase())
    setCommandIndex(0)
    setShowMentions(false)
    return
  }
  
  setShowMentions(false)
  setShowCommands(false)
}
```

- [ ] **Step 3: Add keyboard handling for commands**

Update `handleKeyDown` to handle command dropdown:

```typescript
if (showCommands && filteredCommands.length > 0) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    setCommandIndex(i => Math.min(i + 1, filteredCommands.length - 1))
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    setCommandIndex(i => Math.max(i - 1, 0))
    return
  }
  if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault()
    executeCommand(filteredCommands[commandIndex])
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    setShowCommands(false)
    return
  }
}
```

- [ ] **Step 4: Add command execution logic**

```typescript
const filteredCommands = SLASH_COMMANDS.filter(cmd =>
  !commandFilter || cmd.name.slice(1).startsWith(commandFilter)
)

const executeCommand = (cmd: typeof SLASH_COMMANDS[0]) => {
  setInput('')
  setShowCommands(false)
  
  switch (cmd.name) {
    case '/clear':
      newConversation()
      break
    case '/new':
      newConversation()
      break
    case '/help':
      setMessages(m => [...m, {
        id: `sys-${Date.now()}`,
        role: 'system' as const,
        content: 'Available commands:\n' + SLASH_COMMANDS.map(c => `${c.name} — ${c.description}`).join('\n'),
        timestamp: Date.now(),
      }])
      break
    case '/cost':
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'cost_summary' }))
      }
      break
    case '/munger':
    case '/woz':
    case '/ogilvy':
    case '/taleb':
      const agent = cmd.name.slice(1)
      setInput(`@${agent} `)
      break
    case '/export':
      const text = messages.map(m => `[${m.role}${m.agentId ? `/${m.agentId}` : ''}] ${m.content}`).join('\n\n')
      navigator.clipboard.writeText(text)
      setMessages(m => [...m, {
        id: `sys-${Date.now()}`,
        role: 'system' as const,
        content: 'Conversation copied to clipboard.',
        timestamp: Date.now(),
      }])
      break
  }
}
```

- [ ] **Step 5: Add command dropdown UI**

```tsx
{showCommands && filteredCommands.length > 0 && (
  <div className="absolute bottom-full left-4 mb-1 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-lg z-10 w-72">
    {filteredCommands.map((cmd, idx) => (
      <button
        key={cmd.name}
        onClick={() => executeCommand(cmd)}
        className={`w-full px-4 py-2 text-left hover:bg-gray-700 flex items-center gap-3 ${
          idx === commandIndex ? 'bg-gray-700 text-white' : ''
        }`}
      >
        <span>{cmd.icon}</span>
        <span className="text-sm font-mono text-blue-300">{cmd.name}</span>
        <span className="text-xs text-gray-500 ml-auto">{cmd.description}</span>
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 6: Verify**

Run: `cd /home/jam/workspace/ParallaxAI && npm run build`
Expected: Build succeeds.

---

## Task 9: Web UI Global Styling

**Covers:** Item 9 — 全局 UI 优化

**Files:**
- Modify: `web-ui/src/index.css` — scrollbar styling
- Modify: `web-ui/src/App.tsx` — sidebar layout adjustments

- [ ] **Step 1: Add scrollbar styling**

In `web-ui/src/index.css`, append:

```css
@import "tailwindcss";

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0a0a0a;
  color: #e0e0e0;
}

/* Dark scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Firefox scrollbar */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

/* Smooth scrolling */
* {
  scroll-behavior: smooth;
}

/* Selection color */
::selection {
  background: rgba(59, 130, 246, 0.3);
}
```

- [ ] **Step 2: Fix sidebar scroll area**

In `web-ui/src/App.tsx`, update the conversation list scroll container to use proper overflow:

```tsx
<div className="flex-1 overflow-y-auto border-t border-gray-800 min-h-0">
```

- [ ] **Step 3: Verify**

Run: `cd /home/jam/workspace/ParallaxAI && npm run build`
Expected: Build succeeds.

---

## Task 10: Build & Integration Test

- [ ] **Step 1: Full build**

Run: `cd /home/jam/workspace/ParallaxAI && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Start gateway and verify**

Run: `cd /home/jam/workspace/ParallaxAI && npm start &`
Wait for startup, then:

Run: `curl -s http://localhost:46447/api/roles`
Expected: JSON array of roles.

Run: `curl -s http://localhost:46447/api/knowledge/stats`
Expected: JSON with document/chunk counts.

- [ ] **Step 3: Start web UI**

Run: `cd /home/jam/workspace/ParallaxAI/web-ui && npm run dev`
Expected: Vite dev server starts on port 45445.

- [ ] **Step 4: Verify all tabs work**

Open http://localhost:45445 and verify:
- Chat tab: messages display, @mention dropdown works with keyboard
- Agents tab: shows agent statuses
- Roles tab: loads role list
- Tasks tab: shows delegation board (empty initially)
- Cron tab: shows scheduled tasks (empty initially)
- Bottom bar: shows token/cost counters
- Slash commands: type `/` in input, dropdown appears with keyboard nav
