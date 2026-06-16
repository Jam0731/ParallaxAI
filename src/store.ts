import Database from "better-sqlite3"
import { join } from "path"
import { mkdirSync } from "fs"
import { nanoid } from "nanoid"
import type {
  Message, Conversation, Branch, CostEntry,
  AgentId, MessageRole, StopReason, AgentStatus,
} from "./types.js"

export class Store {
  public db: Database.Database

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true })
    const dbPath = join(dataDir, "parallax.db")
    this.db = new Database(dbPath)
    this.db.pragma("journal_mode = WAL")
    this.db.pragma("foreign_keys = ON")
    this.migrate()
  }

  private safeAddColumn(table: string, column: string, type: string): void {
    try {
      this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
    } catch (e: any) {
      // Column already exists — ignore
      if (!e.message?.includes("duplicate column")) throw e
    }
  }

  private migrate(): void {
    this.db.exec(`
      -- Conversations
      CREATE TABLE IF NOT EXISTS conversations (
        id            TEXT PRIMARY KEY,
        title         TEXT NOT NULL,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL,
        active_branch TEXT NOT NULL DEFAULT 'main',
        metadata      TEXT
      );

      -- Messages
      CREATE TABLE IF NOT EXISTS messages (
        id              TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        branch_id       TEXT NOT NULL DEFAULT 'main',
        role            TEXT NOT NULL,
        agent_id        TEXT,
        adapter_id      TEXT,
        content         TEXT NOT NULL,
        metadata        TEXT,
        created_at      INTEGER NOT NULL,
        tokens_used     INTEGER,
        cost_usd        REAL
      );
      CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_msg_branch ON messages(conversation_id, branch_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_msg_agent ON messages(agent_id);

      -- Branches
      CREATE TABLE IF NOT EXISTS branches (
        id              TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        name            TEXT NOT NULL,
        fork_point      TEXT NOT NULL REFERENCES messages(id),
        created_at      INTEGER NOT NULL,
        is_active       INTEGER NOT NULL DEFAULT 0
      );

      -- Cost entries
      CREATE TABLE IF NOT EXISTS cost_entries (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id        TEXT NOT NULL,
        adapter_id      TEXT NOT NULL,
        model           TEXT NOT NULL,
        input_tokens    INTEGER NOT NULL,
        output_tokens   INTEGER NOT NULL,
        cost_usd        REAL NOT NULL,
        conversation_id TEXT,
        message_id      TEXT,
        created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE INDEX IF NOT EXISTS idx_cost_agent ON cost_entries(agent_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_cost_time ON cost_entries(created_at);

      -- Budgets
      CREATE TABLE IF NOT EXISTS budgets (
        id          TEXT PRIMARY KEY,
        scope       TEXT NOT NULL,
        scope_id    TEXT,
        amount_usd  REAL NOT NULL,
        period      TEXT,
        alert_at    REAL NOT NULL DEFAULT 0.8,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );

      -- Agent performance
      CREATE TABLE IF NOT EXISTS agent_performance (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id      TEXT NOT NULL,
        task_type     TEXT NOT NULL,
        success       INTEGER NOT NULL,
        duration_ms   INTEGER NOT NULL,
        tokens_used   INTEGER NOT NULL,
        cost_usd      REAL NOT NULL DEFAULT 0,
        user_rating   INTEGER,
        error_type    TEXT,
        delegated_by  TEXT,
        created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE INDEX IF NOT EXISTS idx_perf_agent ON agent_performance(agent_id);
      CREATE INDEX IF NOT EXISTS idx_perf_task ON agent_performance(task_type);

      -- Memory entries
      CREATE TABLE IF NOT EXISTS memory_entries (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        path            TEXT NOT NULL UNIQUE,
        scope           TEXT NOT NULL,
        scope_id        TEXT NOT NULL DEFAULT '',
        type            TEXT NOT NULL,
        body            TEXT NOT NULL,
        fingerprint     TEXT NOT NULL,
        last_indexed_at INTEGER NOT NULL,
        agent_id        TEXT,
        created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        updated_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      );
      CREATE INDEX IF NOT EXISTS idx_mem_scope ON memory_entries(scope, scope_id);
      CREATE INDEX IF NOT EXISTS idx_mem_agent ON memory_entries(agent_id);

      -- FTS5 virtual table for memory search
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        body,
        content='memory_entries',
        content_rowid='id'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON memory_entries BEGIN
        INSERT INTO memory_fts(rowid, body) VALUES (new.id, new.body);
      END;
      CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON memory_entries BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, body) VALUES ('delete', old.id, old.body);
      END;
      CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON memory_entries BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, body) VALUES ('delete', old.id, old.body);
        INSERT INTO memory_fts(rowid, body) VALUES (new.id, new.body);
      END;

      -- Cron jobs
      CREATE TABLE IF NOT EXISTS cron_jobs (
        id                  TEXT PRIMARY KEY,
        name                TEXT NOT NULL,
        description         TEXT,
        schedule_type       TEXT NOT NULL,
        schedule_value      TEXT NOT NULL,
        timezone            TEXT DEFAULT 'UTC',
        payload_type        TEXT NOT NULL,
        payload_data        TEXT NOT NULL,
        target_agent        TEXT,
        enabled             INTEGER NOT NULL DEFAULT 1,
        last_run_at         INTEGER,
        last_status         TEXT,
        last_error          TEXT,
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        created_at          INTEGER NOT NULL,
        updated_at          INTEGER NOT NULL
      );

      -- Cron runs
      CREATE TABLE IF NOT EXISTS cron_runs (
        id           TEXT PRIMARY KEY,
        job_id       TEXT NOT NULL REFERENCES cron_jobs(id),
        started_at   INTEGER NOT NULL,
        completed_at INTEGER,
        status       TEXT NOT NULL,
        output       TEXT,
        error        TEXT,
        agent_id     TEXT,
        tokens_used  INTEGER,
        cost_usd     REAL
      );

      -- Dream runs
      CREATE TABLE IF NOT EXISTS dream_runs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at      INTEGER NOT NULL,
        completed_at    INTEGER,
        status          TEXT NOT NULL,
        entries_added   INTEGER DEFAULT 0,
        entries_merged  INTEGER DEFAULT 0,
        entries_pruned  INTEGER DEFAULT 0,
        error           TEXT
      );

      -- Session mappings (persist agent session IDs)
      CREATE TABLE IF NOT EXISTS session_mappings (
        agent_id        TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        session_id      TEXT NOT NULL,
        adapter_id      TEXT NOT NULL,
        context_hash    TEXT,
        created_at      INTEGER NOT NULL,
        updated_at      INTEGER NOT NULL,
        PRIMARY KEY (agent_id, conversation_id)
      );
    `)

    // Incremental migrations for existing databases
    this.safeAddColumn("session_mappings", "context_hash", "TEXT")
    this.safeAddColumn("session_mappings", "workspace_id", "TEXT")
    this.safeAddColumn("conversations", "workspace_id", "TEXT")
    this.safeAddColumn("delegated_tasks", "result", "TEXT")
    this.safeAddColumn("delegated_tasks", "completed_at", "INTEGER")

    this.db.exec(`
      -- Delegated tasks (track delegation results)
      CREATE TABLE IF NOT EXISTS delegated_tasks (
        id                TEXT PRIMARY KEY,
        conversation_id   TEXT NOT NULL,
        delegating_agent  TEXT NOT NULL,
        target_agent      TEXT NOT NULL,
        task              TEXT NOT NULL,
        status            TEXT NOT NULL DEFAULT 'pending',
        result            TEXT,
        created_at        INTEGER NOT NULL,
        completed_at      INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_delconv ON delegated_tasks(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_delagent ON delegated_tasks(delegating_agent);

      -- Workspaces
      CREATE TABLE IF NOT EXISTS workspaces (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        path            TEXT NOT NULL UNIQUE,
        is_default      INTEGER NOT NULL DEFAULT 0,
        created_at      INTEGER NOT NULL,
        last_active_at  INTEGER NOT NULL
      );

      -- Roles
      CREATE TABLE IF NOT EXISTS roles (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        adapter       TEXT NOT NULL,
        fallback      TEXT DEFAULT '[]',
        config_dir    TEXT NOT NULL,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL
      );

      -- Knowledge documents
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id          TEXT PRIMARY KEY,
        source      TEXT NOT NULL,
        title       TEXT NOT NULL,
        path        TEXT,
        content     TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        indexed_at  INTEGER NOT NULL
      );

      -- Knowledge chunks
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id          TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content     TEXT NOT NULL,
        token_count INTEGER NOT NULL
      );

      -- Knowledge FTS
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        title,
        content,
        content='knowledge_chunks',
        content_rowid='rowid'
      );
    `)
  }

  // ── Conversations ──

  createConversation(id: string, title: string, workspaceId?: string): Conversation {
    const now = Date.now()
    this.db.prepare(
      "INSERT INTO conversations (id, title, created_at, updated_at, workspace_id) VALUES (?, ?, ?, ?, ?)"
    ).run(id, title, now, now, workspaceId ?? null)
    return { id, title, createdAt: now, updatedAt: now, activeBranch: "main" }
  }

  getConversation(id: string): (Conversation & { workspaceId?: string }) | undefined {
    const row = this.db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as any
    if (!row) return undefined
    return {
      id: row.id, title: row.title, createdAt: row.created_at,
      updatedAt: row.updated_at, activeBranch: row.active_branch,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      workspaceId: row.workspace_id ?? undefined,
    }
  }

  listConversations(): Array<Conversation & { workspaceId?: string; workspaceName?: string }> {
    const rows = this.db.prepare(`
      SELECT c.*, w.name as workspace_name 
      FROM conversations c 
      LEFT JOIN workspaces w ON w.id = c.workspace_id 
      ORDER BY c.updated_at DESC
    `).all() as any[]
    return rows.map(r => ({
      id: r.id, title: r.title, createdAt: r.created_at,
      updatedAt: r.updated_at, activeBranch: r.active_branch,
      workspaceId: r.workspace_id ?? undefined,
      workspaceName: r.workspace_name ?? undefined,
    }))
  }

  // ── Messages ──

  addMessage(msg: Omit<Message, "createdAt">): Message {
    const createdAt = Date.now()
    this.db.prepare(
      `INSERT INTO messages (id, conversation_id, branch_id, role, agent_id, adapter_id, content, metadata, created_at, tokens_used, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      msg.id, msg.conversationId, msg.branchId, msg.role,
      msg.agentId ?? null, msg.adapterId ?? null, msg.content,
      msg.metadata ? JSON.stringify(msg.metadata) : null,
      createdAt, msg.tokensUsed ?? null, msg.costUsd ?? null,
    )
    this.db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(createdAt, msg.conversationId)
    return { ...msg, createdAt }
  }

  getMessages(conversationId: string, branchId?: string, limit = 100): Message[] {
    let sql = "SELECT * FROM messages WHERE conversation_id = ?"
    const params: any[] = [conversationId]
    if (branchId) {
      sql += " AND (branch_id = 'main' OR branch_id = ?)"
      params.push(branchId)
    }
    sql += " ORDER BY created_at ASC LIMIT ?"
    params.push(limit)
    const rows = this.db.prepare(sql).all(...params) as any[]
    return rows.map(this.rowToMessage)
  }

  private rowToMessage(r: any): Message {
    return {
      id: r.id, conversationId: r.conversation_id, branchId: r.branch_id,
      role: r.role, agentId: r.agent_id, adapterId: r.adapter_id,
      content: r.content, metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      createdAt: r.created_at, tokensUsed: r.tokens_used, costUsd: r.cost_usd,
    }
  }

  // ── Cost ──

  recordCost(entry: CostEntry): void {
    this.db.prepare(
      `INSERT INTO cost_entries (agent_id, adapter_id, model, input_tokens, output_tokens, cost_usd, conversation_id, message_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(entry.agentId, entry.adapterId, entry.model, entry.inputTokens,
      entry.outputTokens, entry.costUsd, entry.conversationId ?? null,
      entry.messageId ?? null, entry.timestamp)
  }

  getCostSummary(agentId?: AgentId, period?: "daily" | "weekly" | "monthly"): { totalUsd: number; entries: number } {
    let sql = "SELECT COALESCE(SUM(cost_usd), 0) as total, COUNT(*) as cnt FROM cost_entries WHERE 1=1"
    const params: any[] = []
    if (agentId) { sql += " AND agent_id = ?"; params.push(agentId) }
    if (period === "daily") { sql += " AND created_at > unixepoch() * 1000 - 86400000" }
    if (period === "weekly") { sql += " AND created_at > unixepoch() * 1000 - 604800000" }
    if (period === "monthly") { sql += " AND created_at > unixepoch() * 1000 - 2592000000" }
    const row = this.db.prepare(sql).get(...params) as any
    return { totalUsd: row.total, entries: row.cnt }
  }

  // ── Performance ──

  recordPerformance(entry: {
    agentId: AgentId; taskType: string; success: boolean;
    durationMs: number; tokensUsed: number; costUsd: number;
    delegatedBy?: AgentId; errorType?: string
  }): void {
    this.db.prepare(
      `INSERT INTO agent_performance (agent_id, task_type, success, duration_ms, tokens_used, cost_usd, delegated_by, error_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(entry.agentId, entry.taskType, entry.success ? 1 : 0,
      entry.durationMs, entry.tokensUsed, entry.costUsd,
      entry.delegatedBy ?? null, entry.errorType ?? null)
  }

  getPerformanceStats(agentId?: AgentId): Array<{
    agentId: string; taskType: string; successRate: number;
    avgDurationMs: number; totalTasks: number
  }> {
    let sql = `SELECT agent_id, task_type,
      AVG(success) as success_rate, AVG(duration_ms) as avg_duration, COUNT(*) as total
      FROM agent_performance`
    const params: any[] = []
    if (agentId) { sql += " WHERE agent_id = ?"; params.push(agentId) }
    sql += " GROUP BY agent_id, task_type"
    const rows = this.db.prepare(sql).all(...params) as any[]
    return rows.map(r => ({
      agentId: r.agent_id, taskType: r.task_type,
      successRate: r.success_rate, avgDurationMs: r.avg_duration, totalTasks: r.total,
    }))
  }

  // ── Memory ──

  upsertMemory(entry: {
    path: string; scope: string; scopeId: string; type: string;
    body: string; fingerprint: string; agentId?: string
  }): void {
    const now = Date.now()
    this.db.prepare(
      `INSERT INTO memory_entries (path, scope, scope_id, type, body, fingerprint, last_indexed_at, agent_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(path) DO UPDATE SET
         body = excluded.body, fingerprint = excluded.fingerprint,
         last_indexed_at = excluded.last_indexed_at, updated_at = excluded.updated_at`
    ).run(entry.path, entry.scope, entry.scopeId, entry.type,
      entry.body, entry.fingerprint, now, entry.agentId ?? null, now, now)
  }

  searchMemory(input: {
    query: string; scope?: string; scopeId?: string;
    agentId?: string; limit?: number
  }): Array<{ path: string; snippet: string; score: number; scope: string; scopeId: string; agentId?: string }> {
    const limit = input.limit ?? 10
    const ftsQuery = this.buildFtsQuery(input.query)
    if (!ftsQuery) return []

    const conditions: string[] = []
    const params: any[] = []
    if (input.scope) { conditions.push("me.scope = ?"); params.push(input.scope) }
    if (input.scopeId) { conditions.push("me.scope_id = ?"); params.push(input.scopeId) }
    if (input.agentId) { conditions.push("me.agent_id = ?"); params.push(input.agentId) }
    const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : ""

    const fetchLimit = Math.min(limit * 3, 50)
    const sql = `
      SELECT me.path, me.scope, me.scope_id, me.agent_id,
             snippet(memory_fts_idx, 0, '<<', '>>', '...', 32) AS snippet,
             bm25(memory_fts_idx) AS score
      FROM memory_fts_idx
      JOIN memory_entries me ON me.id = memory_fts_idx.rowid
      WHERE memory_fts_idx MATCH ?
      ${whereClause}
      ORDER BY score
      LIMIT ?
    `

    const rows = this.db.prepare(sql).all(this.buildFtsQuery(input.query), ...[], fetchLimit) as any[]
    const mapped = rows.map(r => ({
      path: r.path, snippet: r.snippet, score: -r.score,
      scope: r.scope, scopeId: r.scope_id, agentId: r.agent_id ?? undefined,
    }))
    if (mapped.length === 0) return []
    const topScore = mapped[0].score
    const cutoff = topScore * 0.15
    return mapped.filter((r, i) => i === 0 || r.score >= cutoff).slice(0, limit)
  }

  private buildFtsQuery(input: string): string {
    const tokens = input.replace(/[^\w\s]/g, " ").trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return ""
    return tokens.map(t => `"${t}"`).join(" OR ")
  }

  // ── Session Mappings ──

  saveSessionMapping(agentId: string, conversationId: string, sessionId: string, adapterId: string, contextHash?: string, workspaceId?: string): void {
    const now = Date.now()
    this.db.prepare(
      `INSERT INTO session_mappings (agent_id, conversation_id, session_id, adapter_id, context_hash, workspace_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(agent_id, conversation_id) DO UPDATE SET
         session_id = excluded.session_id, adapter_id = excluded.adapter_id, 
         context_hash = excluded.context_hash, workspace_id = excluded.workspace_id, updated_at = excluded.updated_at`
    ).run(agentId, conversationId, sessionId, adapterId, contextHash ?? null, workspaceId ?? null, now, now)

    // Also backfill conversation's workspace_id if not set
    if (workspaceId) {
      this.db.prepare(
        "UPDATE conversations SET workspace_id = ? WHERE id = ? AND workspace_id IS NULL"
      ).run(workspaceId, conversationId)
    }
  }

  getSessionMapping(agentId: string, conversationId: string): { sessionId: string; adapterId: string; contextHash?: string } | undefined {
    const row = this.db.prepare(
      "SELECT session_id, adapter_id, context_hash FROM session_mappings WHERE agent_id = ? AND conversation_id = ?"
    ).get(agentId, conversationId) as any
    return row ? { sessionId: row.session_id, adapterId: row.adapter_id, contextHash: row.context_hash ?? undefined } : undefined
  }

  deleteSessionMapping(agentId: string, conversationId: string): void {
    this.db.prepare("DELETE FROM session_mappings WHERE agent_id = ? AND conversation_id = ?")
      .run(agentId, conversationId)
  }

  getConversationWorkspace(conversationId: string): string | undefined {
    // Check conversations table first (set at creation time)
    const convRow = this.db.prepare(
      "SELECT workspace_id FROM conversations WHERE id = ? AND workspace_id IS NOT NULL"
    ).get(conversationId) as any
    if (convRow?.workspace_id) return convRow.workspace_id

    // Fallback: check session_mappings
    const mapRow = this.db.prepare(
      "SELECT workspace_id FROM session_mappings WHERE conversation_id = ? AND workspace_id IS NOT NULL LIMIT 1"
    ).get(conversationId) as any
    return mapRow?.workspace_id ?? undefined
  }

  // ── Delegated Tasks ──

  saveDelegatedTask(task: { id: string; conversationId: string; delegatingAgent: string; targetAgent: string; task: string; status: string; result?: string }): void {
    const now = Date.now()
    this.db.prepare(
      `INSERT INTO delegated_tasks (id, conversation_id, delegating_agent, target_agent, task, status, result, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(task.id, task.conversationId, task.delegatingAgent, task.targetAgent, task.task, task.status, task.result ?? null, now, task.status === "completed" ? now : null)
  }

  getDelegatedTasks(conversationId: string): Array<{ id: string; delegatingAgent: string; targetAgent: string; task: string; status: string; result?: string }> {
    return this.db.prepare(
      "SELECT id, delegating_agent, target_agent, task, status, result FROM delegated_tasks WHERE conversation_id = ? ORDER BY created_at"
    ).all(conversationId) as any[]
  }

  // ── Workspaces ──

  createWorkspace(id: string, name: string, path: string, isDefault: boolean = false): void {
    const now = Date.now()
    this.db.prepare(
      "INSERT INTO workspaces (id, name, path, is_default, created_at, last_active_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, name, path, isDefault ? 1 : 0, now, now)
  }

  getWorkspace(id: string): { id: string; name: string; path: string; isDefault: boolean } | undefined {
    const row = this.db.prepare("SELECT id, name, path, is_default FROM workspaces WHERE id = ?").get(id) as any
    return row ? { id: row.id, name: row.name, path: row.path, isDefault: !!row.is_default } : undefined
  }

  getWorkspaceByPath(path: string): { id: string; name: string; path: string; isDefault: boolean } | undefined {
    const row = this.db.prepare("SELECT id, name, path, is_default FROM workspaces WHERE path = ?").get(path) as any
    return row ? { id: row.id, name: row.name, path: row.path, isDefault: !!row.is_default } : undefined
  }

  getMostRecentWorkspace(): { id: string; name: string; path: string; isDefault: boolean } | undefined {
    const row = this.db.prepare("SELECT id, name, path, is_default FROM workspaces ORDER BY last_active_at DESC LIMIT 1").get() as any
    return row ? { id: row.id, name: row.name, path: row.path, isDefault: !!row.is_default } : undefined
  }

  listWorkspaces(): Array<{ id: string; name: string; path: string; isDefault: boolean }> {
    return this.db.prepare("SELECT id, name, path, is_default FROM workspaces ORDER BY last_active_at DESC").all() as any[]
  }

  updateWorkspaceLastActive(id: string): void {
    this.db.prepare("UPDATE workspaces SET last_active_at = ? WHERE id = ?").run(Date.now(), id)
  }

  // ── Roles ──

  createRole(id: string, name: string, adapter: string, fallback: string[], configDir: string): void {
    const now = Date.now()
    this.db.prepare(
      "INSERT INTO roles (id, name, adapter, fallback, config_dir, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, name, adapter, JSON.stringify(fallback), configDir, now, now)
  }

  getRole(id: string): { id: string; name: string; adapter: string; fallback: string[]; configDir: string } | undefined {
    const row = this.db.prepare("SELECT id, name, adapter, fallback, config_dir FROM roles WHERE id = ?").get(id) as any
    return row ? { id: row.id, name: row.name, adapter: row.adapter, fallback: JSON.parse(row.fallback), configDir: row.config_dir } : undefined
  }

  listRoles(): Array<{ id: string; name: string; adapter: string; fallback: string[]; configDir: string }> {
    const rows = this.db.prepare("SELECT id, name, adapter, fallback, config_dir FROM roles ORDER BY name").all() as any[]
    return rows.map(r => ({ id: r.id, name: r.name, adapter: r.adapter, fallback: JSON.parse(r.fallback), configDir: r.config_dir }))
  }

  updateRole(id: string, updates: { name?: string; adapter?: string; fallback?: string[] }): void {
    const parts: string[] = []
    const params: any[] = []
    if (updates.name !== undefined) { parts.push("name = ?"); params.push(updates.name) }
    if (updates.adapter !== undefined) { parts.push("adapter = ?"); params.push(updates.adapter) }
    if (updates.fallback !== undefined) { parts.push("fallback = ?"); params.push(JSON.stringify(updates.fallback)) }
    parts.push("updated_at = ?")
    params.push(Date.now())
    params.push(id)
    this.db.prepare(`UPDATE roles SET ${parts.join(", ")} WHERE id = ?`).run(...params)
  }

  deleteRole(id: string): void {
    this.db.prepare("DELETE FROM roles WHERE id = ?").run(id)
  }

  listDelegatedTasks(limit = 50): Array<{ id: string; conversationId: string; delegatingAgent: string; targetAgent: string; task: string; status: string; result?: string; createdAt: number; completedAt?: number }> {
    return this.db.prepare(
      "SELECT id, conversation_id, delegating_agent, target_agent, task, status, result, created_at, completed_at FROM delegated_tasks ORDER BY created_at DESC LIMIT ?"
    ).all(limit) as any[]
  }

  // ── Cost Summary ──

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

  // ── Cron ──

  listCronJobs(): Array<{ id: string; name: string; description?: string; scheduleType: string; scheduleValue: string; targetAgent?: string; enabled: boolean; lastRunAt?: number; lastStatus?: string; consecutiveFailures: number }> {
    return this.db.prepare(
      "SELECT id, name, description, schedule_type as scheduleType, schedule_value as scheduleValue, target_agent as targetAgent, enabled, last_run_at as lastRunAt, last_status as lastStatus, consecutive_failures as consecutiveFailures FROM cron_jobs ORDER BY created_at ASC"
    ).all() as any[]
  }

  listCronRuns(jobId?: string, limit = 20): Array<{ id: string; jobId: string; startedAt: number; completedAt?: number; status: string; output?: string; error?: string }> {
    let sql = "SELECT id, job_id as jobId, started_at as startedAt, completed_at as completedAt, status, output, error FROM cron_runs"
    const params: any[] = []
    if (jobId) { sql += " WHERE job_id = ?"; params.push(jobId) }
    sql += " ORDER BY started_at DESC LIMIT ?"
    params.push(limit)
    return this.db.prepare(sql).all(...params) as any[]
  }

  addCronJob(job: { name: string; description?: string; scheduleType: string; scheduleValue: string; targetAgent?: string; payloadType?: string; payloadData?: string }): string {
    const id = nanoid(10)
    const now = Date.now()
    this.db.prepare(
      `INSERT INTO cron_jobs (id, name, description, schedule_type, schedule_value, timezone, payload_type, payload_data, target_agent, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, job.name, job.description ?? null, job.scheduleType, job.scheduleValue, 'UTC',
      job.payloadType ?? 'agent_turn', job.payloadData ?? '{}', job.targetAgent ?? null, 1, now, now)
    return id
  }

  removeCronJob(jobId: string): void {
    this.db.prepare("DELETE FROM cron_runs WHERE job_id = ?").run(jobId)
    this.db.prepare("DELETE FROM cron_jobs WHERE id = ?").run(jobId)
  }

  toggleCronJob(jobId: string, enabled: boolean): void {
    this.db.prepare("UPDATE cron_jobs SET enabled = ?, updated_at = ? WHERE id = ?").run(enabled ? 1 : 0, Date.now(), jobId)
  }

  getCronJob(jobId: string): any {
    return this.db.prepare("SELECT * FROM cron_jobs WHERE id = ?").get(jobId)
  }

  close(): void {
    this.db.close()
  }
}
