import { spawn, type ChildProcess } from "child_process"
import { EventEmitter } from "events"
import { AcpConnection, AcpError } from "./acp-connection.js"
import type {
  AgentAdapter, AgentChunk, AgentResponse, AgentTask,
  AdapterConfig, DetectResult, HealthStatus, UsageInfo, ContentBlock,
} from "../types.js"

export abstract class AcpAdapter extends EventEmitter implements AgentAdapter {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly capabilities: string[]
  abstract readonly command: string
  abstract readonly acpArgs: string[]

  protected process: ChildProcess | null = null
  protected conn: AcpConnection | null = null
  protected sessionIds = new Map<string, string>() // conversationId → sessionId
  protected config: AdapterConfig = {}

  async detect(): Promise<DetectResult> {
    try {
      const { execSync } = await import("child_process")
      const output = execSync(this.versionCommand(), { timeout: 5_000, encoding: "utf-8" }).trim()
      return { found: true, version: output }
    } catch {
      return { found: false, error: `${this.command} not found` }
    }
  }

  protected versionCommand(): string {
    return `${this.command} --version`
  }

  async initialize(config: AdapterConfig = {}): Promise<void> {
    this.config = config
    this.process = spawn(this.command, this.acpArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...config.env },
    })
    this.process.stderr?.on("data", () => {})
    this.process.on("exit", () => {
      this.process = null
      this.conn?.close()
      this.conn = null
    })
    this.conn = new AcpConnection(this.process.stdin!, this.process.stdout!)
    await this.conn.initialize()
  }

  async shutdown(): Promise<void> {
    this.conn?.close()
    this.process?.kill("SIGTERM")
    this.process = null
    this.conn = null
    this.sessionIds.clear()
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.process || !this.conn || this.conn.isClosed) {
      return { healthy: false, lastError: "Not connected" }
    }
    try {
      await this.conn.request("session/list", {}, 5_000)
      return { healthy: true }
    } catch (err) {
      return { healthy: false, lastError: String(err) }
    }
  }

  async run(task: AgentTask): Promise<AgentResponse> {
    const start = Date.now()
    const chunks: string[] = []
    let usage: UsageInfo | undefined

    for await (const chunk of this.runStream(task)) {
      if (chunk.type === "text") chunks.push(chunk.content ?? "")
      if (chunk.type === "usage") usage = chunk.usage
    }

    return {
      text: chunks.join(""),
      usage: usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, durationMs: Date.now() - start },
      stopReason: "end_turn",
      durationMs: Date.now() - start,
    }
  }

  async *runStream(task: AgentTask): AsyncIterable<AgentChunk> {
    if (!this.conn) throw new AcpError(-1, "Not initialized")

    const conversationId = task.conversationId ?? "default"
    let sessionId = this.sessionIds.get(conversationId)

    if (!sessionId) {
      const result = await this.conn.request("session/new", {
        cwd: task.workDir ?? process.cwd(),
        mcpServers: [],
      }) as { sessionId: string }
      sessionId = result.sessionId
      this.sessionIds.set(conversationId, sessionId)
    }

    const prompt = this.buildPrompt(task)
    yield* this.promptStream(sessionId, prompt)
  }

  protected async *promptStream(sessionId: string, prompt: ContentBlock[]): AsyncIterable<AgentChunk> {
    if (!this.conn) throw new AcpError(-1, "Not initialized")

    const chunks: AgentChunk[] = []
    let resolveNext: (() => void) | null = null

    const handler = (params: unknown) => {
      const p = params as any
      if (p.sessionId !== sessionId) return
      const update = p.update ?? p
      const chunk = this.mapSessionUpdate(update)
      if (chunk) {
        chunks.push(chunk)
        resolveNext?.()
      }
    }

    this.conn.onNotification("session/update", handler)

    try {
      this.conn.request("session/prompt", { sessionId, prompt }).catch(() => {})

      while (true) {
        if (chunks.length > 0) {
          const chunk = chunks.shift()!
          yield chunk
          if (chunk.type === "done" || chunk.type === "error") break
        } else {
          await new Promise<void>(r => { resolveNext = r })
          resolveNext = null
        }
      }
    } finally {
      this.conn.offNotification("session/update", handler)
    }
  }

  protected mapSessionUpdate(update: any): AgentChunk | null {
    if (!update) return null
    switch (update.sessionUpdate ?? update.type ?? update.kind) {
      case "agent_message_chunk":
      case "text":
      case "message_chunk":
        return { type: "text", content: update.content?.text ?? update.text ?? update.content ?? "" }
      case "thinking":
        return { type: "thinking", content: update.content?.text ?? update.text ?? "" }
      case "tool_call":
      case "tool_call_update":
        if (update.status === "completed" || update.status === "failed") {
          return { type: "tool_update", toolCallId: update.toolCallId, toolStatus: update.status, toolOutput: update.content?.[0]?.content?.text }
        }
        return { type: "tool_call", toolCallId: update.toolCallId, toolTitle: update.title, toolStatus: "pending" }
      case "usage_update":
        return { type: "usage", usage: this.extractUsage(update) }
      case "turn_end":
      case "done":
        return { type: "done" }
      default:
        return null
    }
  }

  protected extractUsage(update: any): UsageInfo {
    return {
      inputTokens: update.used?.input ?? update.inputTokens ?? 0,
      outputTokens: update.used?.output ?? update.outputTokens ?? 0,
      totalTokens: update.used?.total ?? update.totalTokens ?? 0,
      costUsd: update.cost?.amount ?? update.costUsd ?? 0,
      durationMs: update.durationMs ?? 0,
    }
  }

  protected buildPrompt(task: AgentTask): ContentBlock[] {
    const blocks: ContentBlock[] = []
    if (task.context) {
      blocks.push({ type: "resource", resource: { uri: "context://skill", text: task.context } })
    }
    if (task.history && task.history.length > 0) {
      const recent = task.history.slice(-10)
      const historyText = recent.map(m => `[${m.role}]: ${m.content}`).join("\n\n")
      blocks.push({ type: "resource", resource: { uri: "context://history", text: historyText } })
    }
    blocks.push({ type: "text", text: task.message })
    return blocks
  }

  async cancel(): Promise<void> {
    // ACP cancel is a notification
  }
}
