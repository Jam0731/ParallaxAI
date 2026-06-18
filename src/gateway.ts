import { WebSocketServer, WebSocket } from "ws"
import { nanoid } from "nanoid"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"
import { Store } from "./store.js"
import { AdapterRegistry } from "./adapters/registry.js"
import { ContextManager } from "./context.js"
import { ErrorHandler } from "./error-handler.js"
import { CostTracker } from "./cost/tracker.js"
import { CheckpointManager } from "./session/checkpoint.js"
import { WorkspaceManager } from "./workspace.js"
import { routeMessage, parseDelegations, LoopDetector } from "./router.js"
import type {
  ClientMessage, ServerMessage, AgentId, AgentStatus,
  Message, UsageInfo, CostEntry, StopReason,
} from "./types.js"

export class Gateway {
  private wss: WebSocketServer
  private clients = new Map<string, WebSocket>()
  private subscriptions = new Map<string, Set<string>>()
  private loopDetector = new LoopDetector()
  private errorHandler: ErrorHandler
  private costTracker: CostTracker
  private checkpointManager: CheckpointManager
  private workspaceManager: WorkspaceManager
  private activeTasks = new Map<string, { agentId: string; conversationId: string; abort: () => void }>()

  constructor(
    private port: number,
    private store: Store,
    private registry: AdapterRegistry,
    private context: ContextManager,
    private dataDir: string,
  ) {
    this.wss = new WebSocketServer({ port })
    this.errorHandler = new ErrorHandler(registry)
    this.costTracker = new CostTracker(store)
    this.checkpointManager = new CheckpointManager(dataDir)
    this.workspaceManager = new WorkspaceManager(store, dataDir)

    // Initialize workspace — restore last used or create default
    const defaultWorkspace = this.workspaceManager.initialize(process.env.PARALLAX_WORKSPACE)
    console.log(`   Workspace: ${defaultWorkspace.name} (${defaultWorkspace.path})`)

    // Load budgets and set up cost alerts
    this.costTracker.loadBudgets()
    this.costTracker.onAlert((msg) => {
      this.broadcastAll({ type: "error", message: msg, code: "BUDGET_ALERT" })
    })

    this.setupConnectionHandling()
    this.setupStatusBroadcast()
  }

  private setupConnectionHandling(): void {
    this.wss.on("connection", (ws) => {
      const clientId = nanoid()
      this.clients.set(clientId, ws)

      // Send current agent statuses
      for (const [agentId, status] of this.registry.getAllStatuses()) {
        this.sendTo(ws, { type: "agent_status", agentId, status })
      }

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString()) as ClientMessage
          this.handleClientMessage(clientId, msg)
        } catch {
          this.sendTo(ws, { type: "error", message: "Invalid JSON", code: "INVALID_JSON" })
        }
      })

      ws.on("close", () => {
        this.clients.delete(clientId)
        for (const subs of this.subscriptions.values()) {
          subs.delete(clientId)
        }
      })

      ws.on("error", () => {
        this.clients.delete(clientId)
      })
    })
  }

  private setupStatusBroadcast(): void {
    this.registry.onStatusChange((agentId, status) => {
      this.broadcastAll({ type: "agent_status", agentId, status })
    })
  }

  private async handleClientMessage(clientId: string, msg: ClientMessage): Promise<void> {
    switch (msg.type) {
      case "chat":
        this.handleChat(clientId, msg.content, msg.conversationId)
        break
      case "subscribe":
        this.subscribe(clientId, msg.conversationId)
        break
      case "unsubscribe":
        this.unsubscribe(clientId, msg.conversationId)
        break
      case "ping":
        this.sendToClient(clientId, { type: "pong" })
        break
      case "cancel":
        this.handleCancel(msg.conversationId)
        break
      case "workspace_list":
        this.sendToClient(clientId, {
          type: "workspace_list",
          workspaces: this.workspaceManager.list(),
          activeId: this.workspaceManager.getActiveId(),
        } as any)
        break
      case "workspace_switch":
        {
          const ws = this.workspaceManager.switchTo(msg.workspaceId)
          if (ws) {
            this.sendToClient(clientId, { type: "workspace_active", workspace: ws } as any)
          }
        }
        break
      case "workspace_create":
        {
          const ws = this.workspaceManager.create(msg.path, msg.name)
          this.sendToClient(clientId, { type: "workspace_active", workspace: ws } as any)
        }
        break
      case "sync":
        this.handleSync(clientId, msg.conversationId, msg.lastMessageId)
        break
      case "conversation_list":
        {
          const conversations = this.store.listConversations()
          this.sendToClient(clientId, { type: "conversation_list", conversations } as any)
        }
        break
      case "conversation_history":
        {
          const messages = this.store.getMessages(msg.conversationId)
          this.sendToClient(clientId, { type: "conversation_history", conversationId: msg.conversationId, messages } as any)
        }
        break
      case "conversation_select":
        {
          const convId = (msg as any).conversationId
          const conv = this.store.getConversation(convId)
          
          if (conv?.workspaceId && conv.workspaceId !== this.workspaceManager.getActiveId()) {
            const hasExplicitWs = this.store.db.prepare(
              "SELECT 1 FROM session_mappings WHERE conversation_id = ? AND workspace_id = ? LIMIT 1"
            ).get(convId, conv.workspaceId)
            
            if (hasExplicitWs) {
              const ws = this.workspaceManager.switchTo(conv.workspaceId)
              if (ws) {
                this.sendToClient(clientId, { type: "workspace_active", workspace: ws } as any)
              }
            }
          }
          
          const messages = this.store.getMessages(convId)
          this.sendToClient(clientId, { type: "conversation_history", conversationId: convId, messages } as any)
        }
        break
      case "conversation_delete":
        {
          const delId = (msg as any).conversationId
          this.store.deleteConversation(delId)
          const conversations = this.store.listConversations()
          this.sendToClient(clientId, { type: "conversation_list", conversations } as any)
        }
        break
      case "conversation_rename":
        {
          const renId = (msg as any).conversationId
          const newTitle = (msg as any).title
          if (renId && newTitle) {
            this.store.renameConversation(renId, newTitle)
            const conversations = this.store.listConversations()
            this.sendToClient(clientId, { type: "conversation_list", conversations } as any)
          }
        }
        break
      case "delegation_tasks":
        {
          const tasks = this.store.listDelegatedTasks((msg as any).limit ?? 50)
          this.sendToClient(clientId, { type: "delegation_tasks", tasks } as any)
        }
        break
      case "cron_jobs":
        {
          const jobs = this.store.listCronJobs()
          this.sendToClient(clientId, { type: "cron_jobs", jobs } as any)
        }
        break
      case "cron_runs":
        {
          const runs = this.store.listCronRuns((msg as any).jobId, (msg as any).limit)
          this.sendToClient(clientId, { type: "cron_runs", runs } as any)
        }
        break
      case "cron_add":
        {
          const jobId = this.store.addCronJob({
            name: (msg as any).name,
            description: (msg as any).description,
            scheduleType: (msg as any).scheduleType,
            scheduleValue: (msg as any).scheduleValue,
            targetAgent: (msg as any).targetAgent,
            payloadType: (msg as any).payloadType,
            payloadData: (msg as any).payloadData,
          })
          const jobs = this.store.listCronJobs()
          this.sendToClient(clientId, { type: "cron_jobs", jobs } as any)
          this.sendToClient(clientId, { type: "cron_created", jobId } as any)
        }
        break
      case "cron_remove":
        {
          this.store.removeCronJob((msg as any).jobId)
          const jobs = this.store.listCronJobs()
          const runs = this.store.listCronRuns(undefined, 20)
          this.sendToClient(clientId, { type: "cron_jobs", jobs } as any)
          this.sendToClient(clientId, { type: "cron_runs", runs } as any)
        }
        break
      case "cron_toggle":
        {
          this.store.toggleCronJob((msg as any).jobId, (msg as any).enabled)
          const jobs = this.store.listCronJobs()
          this.sendToClient(clientId, { type: "cron_jobs", jobs } as any)
        }
        break
      case "cron_run":
        {
          const job = this.store.getCronJob((msg as any).jobId)
          if (job) {
            const runId = nanoid(10)
            this.store.db.prepare(
              `INSERT INTO cron_runs (id, job_id, started_at, status, agent_id) VALUES (?, ?, ?, 'running', ?)`
            ).run(runId, job.id, Date.now(), job.target_agent ?? null)
            // Execute asynchronously
            this.executeCronJob(job, runId).then(() => {
              const jobs = this.store.listCronJobs()
              const runs = this.store.listCronRuns(undefined, 20)
              this.sendToClient(clientId, { type: "cron_jobs", jobs } as any)
              this.sendToClient(clientId, { type: "cron_runs", runs } as any)
            })
          }
        }
        break
      case "delegation_approve":
        {
          const convId = (msg as any).conversationId
          const delegations = (msg as any).delegations as Array<{ target: AgentId; task: string }>
          if (delegations && delegations.length > 0) {
            // Execute approved delegations sequentially
            for (const delegation of delegations) {
              this.loopDetector.incrementDepth(convId)
              await this.executeAgentTurn(clientId, convId, delegation.target, delegation.task, "munger")
            }
            this.loopDetector.resetDepth(convId)
          }
        }
        break
      case "delegation_reject":
        {
          const convId = (msg as any).conversationId
          const userMsg = (msg as any).userMessage
          if (userMsg) {
            // User wants to continue talking to Munger — send their message as a follow-up
            await this.handleChat(clientId, userMsg, convId)
          }
        }
        break
      case "cost_summary":
        {
          const today = this.store.getTodayCost()
          const byAgent = this.store.getCostSummaryByAgent()
          this.sendToClient(clientId, { type: "cost_summary", today, byAgent } as any)
        }
        break
    }
  }

  private async handleChat(clientId: string, content: string, conversationId: string): Promise<void> {
    // Handle gateway-level slash commands
    if (content.startsWith('/compact') && !content.match(/^\/compact\s+@\w+/)) {
      // Gateway-level compact: summarize conversation and clear old messages
      await this.handleCompact(clientId, conversationId)
      return
    }

    const decision = routeMessage(content)

    // Ensure conversation exists
    let conversation = this.store.getConversation(conversationId)
    if (!conversation) {
      conversation = this.store.createConversation(conversationId, content.slice(0, 50), this.workspaceManager.getActiveId())
    }

    // Save user message
    const userMsg = this.store.addMessage({
      id: nanoid(),
      conversationId,
      branchId: conversation.activeBranch,
      role: "user",
      content,
    })

    // Check for loops
    if (this.loopDetector.check(conversationId, "user", decision.targetAgent)) {
      this.sendError(clientId, "Loop detected. Please try a different approach.", "LOOP_DETECTED")
      return
    }

    // Execute with agent
    await this.executeAgentTurn(clientId, conversationId, decision.targetAgent, decision.directMessage)
  }

  private async handleCompact(clientId: string, conversationId: string): Promise<void> {
    const messages = this.store.getMessages(conversationId)
    if (messages.length <= 5) {
      this.sendToClient(clientId, {
        type: "chat_chunk",
        messageId: nanoid(),
        chunk: "Not enough messages to compact. Need more than 5 messages.",
        agentId: "system",
      } as any)
      return
    }

    const summaryId = nanoid()
    this.sendToClient(clientId, {
      type: "chat_start",
      conversationId,
      messageId: summaryId,
      agentId: "system",
    } as any)

    // Build summary of older messages
    const recent = messages.slice(-5)
    const older = messages.slice(0, -5)
    const summaryParts = older.map(m => {
      const agent = m.agentId ? `[${m.agentId}]` : `[${m.role}]`
      const text = m.content.length > 150 ? m.content.slice(0, 150) + '...' : m.content
      return `${agent} ${text}`
    })

    const summary = `[Conversation compacted — ${older.length} messages summarized]\n\nSummary of earlier conversation:\n${summaryParts.join('\n')}\n\n---\nRecent messages preserved below.`

    // Delete older messages, keep recent ones
    const db = this.store.db
    for (const msg of older) {
      db.prepare("DELETE FROM messages WHERE id = ?").run(msg.id)
    }

    // Insert summary as system message
    this.store.addMessage({
      id: summaryId,
      conversationId,
      branchId: "main",
      role: "system",
      content: summary,
    })

    this.sendToClient(clientId, {
      type: "chat_chunk",
      messageId: summaryId,
      chunk: `Compacted: summarized ${older.length} messages, kept ${recent.length} recent messages.`,
      agentId: "system",
    } as any)

    this.sendToClient(clientId, {
      type: "chat_end",
      messageId: summaryId,
      stopReason: "end_turn",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, durationMs: 0 },
    } as any)

    // Reload conversation in client
    const updatedMessages = this.store.getMessages(conversationId)
    this.sendToClient(clientId, {
      type: "conversation_history",
      conversationId,
      messages: updatedMessages,
    } as any)
  }

  private async executeAgentTurn(
    clientId: string,
    conversationId: string,
    agentId: AgentId,
    message: string,
    delegatingAgent?: AgentId,
  ): Promise<void> {
    const messageId = nanoid()
    const taskId = `${conversationId}:${agentId}:${messageId}`

    this.sendToConversation(conversationId, {
      type: "chat_start",
      conversationId,
      messageId,
      agentId,
    })

    // Track this task for cancellation
    let cancelled = false
    const adapter = this.registry.getAdapterForAgent(agentId)
    this.activeTasks.set(taskId, {
      agentId,
      conversationId,
      abort: () => {
        cancelled = true
        try { adapter?.cancel() } catch {}
      },
    })

    try {
      // Load persisted session ID for this agent+conversation
      const sessionMapping = this.store.getSessionMapping(agentId, conversationId)

      // Build context bundle
      const history = this.store.getMessages(conversationId)
      const bundle = this.context.buildContextBundle({
        agentId,
        conversationId,
        history,
        delegatingAgent,
        delegationTask: delegatingAgent ? message : undefined,
        workspaceId: this.workspaceManager.getActiveId(),
      })
      const currentHash = this.context.getVersionHash(bundle)

      // Inject context when:
      // 1. New session (no session ID yet)
      // 2. Context hash changed (shared context updated)
      const isNewSession = !sessionMapping?.sessionId
      const hashChanged = sessionMapping?.contextHash !== currentHash
      let contextStr: string | undefined
      if (isNewSession || hashChanged) {
        contextStr = this.context.formatForPrompt(bundle)
      }

      // Execute with error recovery
      const convWsId = this.store.getConversationWorkspace(conversationId)
      const convWorkspace = convWsId ? this.store.getWorkspace(convWsId) : this.workspaceManager.getActive()

      // Progress callback — forward agent events to frontend in real-time
      const onProgress = (event: import("./types.js").AgentProgressEvent) => {
        if (event.type === "thinking") {
          this.sendToConversation(conversationId, {
            type: "chat_thinking",
            messageId,
            content: event.content ?? "",
            agentId,
          })
        } else if (event.type === "tool_call") {
          this.sendToConversation(conversationId, {
            type: "chat_tool_call",
            messageId,
            toolCallId: event.toolCallId ?? "",
            title: event.toolName ?? "tool",
            status: "running",
          })
        } else if (event.type === "tool_result") {
          this.sendToConversation(conversationId, {
            type: "chat_tool_call",
            messageId,
            toolCallId: event.toolCallId ?? "",
            title: "",
            status: event.status === "completed" ? "completed" : "failed",
          })
        }
      }

      let result = await this.errorHandler.executeWithRetry(agentId, {
        message,
        context: contextStr,
        conversationId,
        sessionId: sessionMapping?.sessionId,
        workDir: convWorkspace?.path,
        agentId,
        timeout: 300_000,
        onEvent: onProgress,
      })

      // Auto-retry: if empty response with existing session, retry with fresh session + full context
      if (result.text.length === 0 && sessionMapping?.sessionId) {
        console.log(`[${agentId}] Empty response with session ${sessionMapping.sessionId}, retrying with fresh session`)
        this.store.deleteSessionMapping(agentId, conversationId)
        const freshContext = this.context.formatForPrompt(bundle)
        result = await this.errorHandler.executeWithRetry(agentId, {
          message,
          context: freshContext,
          conversationId,
          sessionId: undefined,
          workDir: convWorkspace?.path,
          agentId,
          timeout: 300_000,
          onEvent: onProgress,
        })
      }

      // Persist session ID and context hash for future calls
      if (result.sessionId) {
        this.store.saveSessionMapping(agentId, conversationId, result.sessionId, result.adapterId, currentHash, this.workspaceManager.getActiveId())
      }

      // Clean up response (strip subagent metadata)
      const cleanText = this.cleanAgentResponse(result.text)
      console.log(`[${agentId}] raw: ${result.text.length} chars, clean: ${cleanText.length} chars`)

      // Skip empty responses — don't save or send
      if (cleanText.length === 0) {
        this.sendToConversation(conversationId, {
          type: "chat_error",
          messageId,
          error: "Agent returned empty response",
          recoverable: true,
        })
        return
      }

      // Stream chunks
      this.sendToConversation(conversationId, {
        type: "chat_chunk",
        messageId,
        chunk: cleanText,
        agentId,
      })

      // Save assistant message
      const assistantMsg = this.store.addMessage({
        id: messageId,
        conversationId,
        branchId: "main",
        role: "assistant",
        agentId,
        adapterId: result.adapterId,
        content: cleanText,
        tokensUsed: result.usage?.totalTokens,
        costUsd: result.usage?.costUsd,
      })

      // Record cost with budget check
      if (result.usage) {
        const costEntry: CostEntry = {
          agentId,
          adapterId: result.adapterId,
          model: "unknown",
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUsd: result.usage.costUsd,
          conversationId,
          messageId,
          timestamp: Date.now(),
        }
        await this.costTracker.record(costEntry)
        this.store.recordCost(costEntry)

        this.sendToConversation(conversationId, {
          type: "cost_update",
          agentId,
          cost: costEntry,
        })
        this.broadcastAll({ type: "cost_update", agentId, cost: costEntry } as any)
      }

      // Write checkpoint
      const checkpointHistory = this.store.getMessages(conversationId)
      this.checkpointManager.writeCheckpoint({
        conversationId,
        agentId,
        intent: message.slice(0, 100),
        messages: checkpointHistory.slice(-10),
      })

      // Record performance
      this.store.recordPerformance({
        agentId,
        taskType: this.inferTaskType(message),
        success: result.stopReason === "end_turn",
        durationMs: result.durationMs,
        tokensUsed: result.usage?.totalTokens ?? 0,
        costUsd: result.usage?.costUsd ?? 0,
        delegatedBy: delegatingAgent,
      })

      // Send end
      this.sendToConversation(conversationId, {
        type: "chat_end",
        messageId,
        stopReason: result.stopReason,
        usage: result.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, durationMs: result.durationMs },
      })

      // Check for delegations in Munger's reply — require user approval
      if (agentId === "munger" && result.stopReason === "end_turn") {
        this.extractAndUpdateSharedContext(cleanText, this.workspaceManager.getActiveId())

        const delegations = parseDelegations(result.text)
        if (delegations.length > 0) {
          // Send delegation proposal to frontend for user approval
          this.sendToConversation(conversationId, {
            type: "delegation_proposal",
            conversationId,
            delegations: delegations.map(d => ({ target: d.target, task: d.task })),
          } as any)
          // Do NOT execute delegations — wait for user approval
        }
      }

      // If this was a delegated task, notify Munger (message already shown via chat_chunk/chat_end)
      if (delegatingAgent && delegatingAgent !== "user") {
        // Save delegation record
        this.store.saveDelegatedTask({
          id: nanoid(),
          conversationId,
          delegatingAgent,
          targetAgent: agentId,
          task: message,
          status: "completed",
          result: cleanText.slice(0, 1000),
        })

        // Pass result to Munger for review
        await this.executeAgentTurn(
          clientId,
          conversationId,
          delegatingAgent,
          `[任务完成通知] ${agentId} 完成了你的委派任务：\n\n任务：${message}\n\n结果：${cleanText}\n\n请汇总并回复用户。`,
          undefined, // Don't recurse further
        )
      }
    } catch (err) {
      if (cancelled) {
        this.sendToConversation(conversationId, {
          type: "chat_error",
          messageId,
          error: "Task cancelled by user",
          recoverable: false,
        })
      } else {
        this.sendToConversation(conversationId, {
          type: "chat_error",
          messageId,
          error: String(err),
          recoverable: true,
        })
      }
    } finally {
      this.activeTasks.delete(taskId)
      // Broadcast agent status reset to all clients
      this.broadcastAll({ type: "agent_status", agentId, status: "idle" })
    }
  }

  private inferTaskType(message: string): string {
    const lower = message.toLowerCase()
    if (/\b(code|implement|fix|bug|deploy|build)\b/.test(lower)) return "code"
    if (/\b(write|copy|content|article|文案)\b/.test(lower)) return "content"
    if (/\b(analyze|research|investigate|调研)\b/.test(lower)) return "analysis"
    if (/\b(review|check|audit|审查)\b/.test(lower)) return "review"
    return "general"
  }

  private handleCancel(conversationId: string): void {
    let cancelled = 0
    for (const [taskId, task] of this.activeTasks) {
      if (task.conversationId === conversationId) {
        task.abort()
        this.activeTasks.delete(taskId)
        cancelled++
      }
    }
    if (cancelled > 0) {
      this.sendToConversation(conversationId, {
        type: "chat_error",
        messageId: nanoid(),
        error: `Cancelled ${cancelled} running task(s)`,
        recoverable: false,
      })
    }
  }

  private handleSync(clientId: string, conversationId: string, lastMessageId?: string): void {
    const messages = this.store.getMessages(conversationId)
    let startIndex = 0
    if (lastMessageId) {
      const idx = messages.findIndex(m => m.id === lastMessageId)
      if (idx >= 0) startIndex = idx + 1
    }
    for (const msg of messages.slice(startIndex)) {
      this.sendToClient(clientId, {
        type: "history_message",
        message: msg,
      } as any)
    }
    this.sendToClient(clientId, {
      type: "sync_complete",
      conversationId,
    } as any)
  }

  private subscribe(clientId: string, conversationId: string): void {
    const subs = this.subscriptions.get(conversationId) ?? new Set()
    subs.add(clientId)
    this.subscriptions.set(conversationId, subs)
  }

  private unsubscribe(clientId: string, conversationId: string): void {
    this.subscriptions.get(conversationId)?.delete(clientId)
  }

  private sendTo(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  private sendToClient(clientId: string, msg: ServerMessage): void {
    const ws = this.clients.get(clientId)
    if (ws) this.sendTo(ws, msg)
  }

  private sendToConversation(conversationId: string, msg: ServerMessage): void {
    const subs = this.subscriptions.get(conversationId)
    if (subs) {
      for (const clientId of subs) {
        this.sendToClient(clientId, msg)
      }
    }
    // Also send to all clients if no specific subscriptions
    if (!subs || subs.size === 0) {
      this.broadcastAll(msg)
    }
  }

  private broadcastAll(msg: ServerMessage): void {
    for (const ws of this.clients.values()) {
      this.sendTo(ws, msg)
    }
  }

  private cleanAgentResponse(text: string): string {
    // Strip MiMo Code subagent metadata
    // Pattern: **Status**: success\n**Summary**: ...\n\n
    let cleaned = text
    cleaned = cleaned.replace(/^\*\*Status\*\*:.*\n/gm, "")
    cleaned = cleaned.replace(/^\*\*Summary\*\*:.*\n/gm, "")
    cleaned = cleaned.replace(/^\*\*Files touched\*\*:.*\n/gm, "")
    cleaned = cleaned.replace(/^\*\*Findings worth promoting\*\*:.*\n/gm, "")
    // Strip "Forwarded from xxx" lines
    cleaned = cleaned.replace(/^Forwarded from \w+.*\n/gm, "")
    // Strip leading/trailing whitespace
    cleaned = cleaned.trim()
    return cleaned
  }

  private sendError(clientId: string, message: string, code: string): void {
    this.sendToClient(clientId, { type: "error", message, code })
  }

  private extractAndUpdateSharedContext(mungerReply: string, workspaceId?: string): void {
    // Extract [共享上下文更新] block from Munger's reply
    const match = mungerReply.match(/\[共享上下文更新\]\s*\n([\s\S]*?)(?:\n\[|\n\n|$)/)
    if (!match || !workspaceId) return

    const updateContent = match[1]?.trim()
    if (!updateContent) return

    const sharedContextPath = join(this.dataDir, "workspaces", workspaceId, "shared_context.json")
    mkdirSync(join(this.dataDir, "workspaces", workspaceId), { recursive: true })

    let sharedContext: any = { business: {}, team_status: { lastUpdated: 0, updatedBy: "munger", entries: [] } }
    if (existsSync(sharedContextPath)) {
      try {
        sharedContext = JSON.parse(readFileSync(sharedContextPath, "utf-8"))
      } catch { /* use default */ }
    }

    // Add new entry to team_status
    sharedContext.team_status.lastUpdated = Date.now()
    sharedContext.team_status.updatedBy = "munger"
    sharedContext.team_status.entries.push({
      content: updateContent,
      timestamp: Date.now(),
    })

    // Keep only last 20 entries
    if (sharedContext.team_status.entries.length > 20) {
      sharedContext.team_status.entries = sharedContext.team_status.entries.slice(-20)
    }

    writeFileSync(sharedContextPath, JSON.stringify(sharedContext, null, 2))
  }

  private async executeCronJob(job: any, runId: string): Promise<void> {
    try {
      const agentId = job.target_agent ?? "munger"
      const payloadData = JSON.parse(job.payload_data ?? '{}')
      const message = payloadData.message ?? `Scheduled task: ${job.name}`

      // Create a temporary conversation for the cron job
      const conversationId = `cron-${job.id}-${Date.now()}`
      this.store.createConversation(conversationId, `[Cron] ${job.name}`, this.workspaceManager.getActiveId())

      // Execute with the target agent
      const activeWorkspace = this.workspaceManager.getActive()
      const result = await this.errorHandler.executeWithRetry(agentId, {
        message,
        conversationId,
        workDir: activeWorkspace?.path,
        timeout: 120_000,
      })

      this.store.db.prepare(
        `UPDATE cron_runs SET completed_at = ?, status = 'success', output = ?, agent_id = ? WHERE id = ?`
      ).run(Date.now(), result.text.slice(0, 2000), agentId, runId)

      this.store.db.prepare(
        `UPDATE cron_jobs SET last_run_at = ?, last_status = 'success', consecutive_failures = 0 WHERE id = ?`
      ).run(Date.now(), job.id)
    } catch (err) {
      const error = String(err)
      this.store.db.prepare(
        `UPDATE cron_runs SET completed_at = ?, status = 'failed', error = ? WHERE id = ?`
      ).run(Date.now(), error, runId)

      this.store.db.prepare(
        `UPDATE cron_jobs SET last_run_at = ?, last_status = 'failed', last_error = ?, consecutive_failures = consecutive_failures + 1 WHERE id = ?`
      ).run(Date.now(), error, job.id)
    }
  }

  async close(): Promise<void> {
    this.wss.close()
  }

  get address(): string {
    const addr = this.wss.address()
    if (typeof addr === "string") return addr
    if (!addr) return `ws://localhost:${this.port}`
    return `ws://${addr.address}:${addr.port}`
  }
}
