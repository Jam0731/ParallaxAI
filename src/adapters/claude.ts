import { spawn, execSync, type ChildProcess } from "child_process"
import { randomUUID } from "crypto"
import { join, dirname } from "path"
import { existsSync, readFileSync } from "fs"
import { fileURLToPath } from "url"
import { EventEmitter } from "events"
import type {
  AgentAdapter, AgentChunk, AgentResponse, AgentTask,
  AdapterConfig, DetectResult, HealthStatus, UsageInfo,
} from "../types.js"

export class ClaudeAdapter extends EventEmitter implements AgentAdapter {
  readonly id = "claude"
  readonly name = "Claude Code"
  readonly capabilities = ["code", "review", "research", "deploy"]
  private command = process.env.CLAUDE_PATH ?? "claude"
  private config: AdapterConfig = {}
  private runningProcess: ChildProcess | null = null

  async detect(): Promise<DetectResult> {
    try {
      const output = execSync(`${this.command} --version`, { timeout: 5_000, encoding: "utf-8" }).trim()
      return { found: true, version: output }
    } catch {
      return { found: false, error: "claude not found" }
    }
  }

  async initialize(config: AdapterConfig = {}): Promise<void> {
    this.config = config
  }

  async shutdown(): Promise<void> {}

  async healthCheck(): Promise<HealthStatus> {
    try {
      execSync(`${this.command} --version`, { timeout: 5_000 })
      return { healthy: true }
    } catch {
      return { healthy: false, lastError: "claude not responding" }
    }
  }

  async run(task: AgentTask): Promise<AgentResponse> {
    const start = Date.now()
    const chunks: string[] = []
    let usage: UsageInfo | undefined
    let capturedSessionId: string | undefined

    for await (const chunk of this.runStream(task)) {
      if (chunk.type === "text") chunks.push(chunk.content ?? "")
      if (chunk.type === "usage") usage = chunk.usage
      if (chunk.type === "session_id" as any) capturedSessionId = chunk.content
    }

    return {
      text: chunks.join(""),
      usage: usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, durationMs: Date.now() - start },
      stopReason: "end_turn",
      durationMs: Date.now() - start,
      sessionId: capturedSessionId ?? task.sessionId,
    }
  }

  async *runStream(task: AgentTask): AsyncIterable<AgentChunk> {
    // Load skill content for system prompt injection (only on new sessions)
    const isNewSession = !task.sessionId
    const skillContent = isNewSession && task.agentId
      ? this.loadSkillContent(task.agentId)
      : undefined

    // Context is provided by gateway when hash changes (new session or context updated)
    // Always use it when available — gateway controls the timing
    const effectiveMessage = task.context
      ? `${task.context}\n\n---\n\n${task.message}`
      : task.message

    const existingId = task.sessionId
    let args: string[]
    let useStdin = false

    if (existingId) {
      // Resume existing session — no need to re-inject skill
      args = ["--resume", existingId, "--dangerously-skip-permissions", "--output-format", "stream-json", "--verbose"]
      useStdin = true
    } else {
      // New session — inject skill via system prompt
      const newId = randomUUID()
      args = ["-p", effectiveMessage, "--session-id", newId, "--dangerously-skip-permissions", "--output-format", "stream-json", "--verbose"]
      if (skillContent) args.push("--append-system-prompt", skillContent)
      yield { type: "session_id" as any, content: newId }
    }

    const env = { ...process.env, ...this.config.env }
    const child = spawn(this.command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: task.workDir,
      env,
    })

    this.runningProcess = child

    if (useStdin) {
      child.stdin!.write(effectiveMessage + "\n")
      child.stdin!.end()
    }

    child.stderr?.on("data", () => {})

    let gotTextFromAssistant = false
    const rl = (await import("readline")).createInterface({ input: child.stdout! })
    for await (const line of rl) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line)
        const chunk = this.mapStreamEvent(event, gotTextFromAssistant)
        if (chunk) {
          if (chunk.type === "text" && event.type === "assistant") gotTextFromAssistant = true
          // Emit progress events
          if (chunk.type === "text" && chunk.content) {
            task.onEvent?.({ type: "text", content: chunk.content })
          }
          if (chunk.type === "thinking" && chunk.content) {
            task.onEvent?.({ type: "thinking", content: chunk.content })
          }
          if (chunk.type === "tool_call") {
            task.onEvent?.({ type: "tool_call", toolName: chunk.toolTitle, toolCallId: chunk.toolCallId, status: "running" })
          }
          if (chunk.type === "tool_update") {
            task.onEvent?.({ type: "tool_result", toolCallId: chunk.toolCallId, status: chunk.toolStatus === "completed" ? "completed" : "failed" })
          }
          yield chunk
        }
      } catch { /* ignore malformed */ }
    }

    this.runningProcess = null
  }

  private mapStreamEvent(event: any, gotTextFromAssistant: boolean): AgentChunk | null {
    if (!event) return null
    switch (event.type) {
      case "assistant":
        if (event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "text" && block.text) return { type: "text", content: block.text }
            if (block.type === "thinking" && block.thinking) return { type: "thinking", content: block.thinking }
            if (block.type === "tool_use") {
              return { type: "tool_call", toolCallId: block.id, toolTitle: block.name, toolStatus: "running" }
            }
          }
        }
        return null
      case "result":
        // Skip if we already got text from assistant events (avoid duplication)
        if (event.result && !gotTextFromAssistant) return { type: "text", content: event.result }
        return null
      case "system":
        return null
      default:
        return null
    }
  }

  private loadSkillContent(agentId: string): string | undefined {
    const skillPath = join(this.getProjectDir(), "agent-configs", agentId, "SKILL.md")
    if (!existsSync(skillPath)) return undefined
    try {
      return readFileSync(skillPath, "utf-8")
    } catch {
      return undefined
    }
  }

  private getProjectDir(): string {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    return join(__dirname, "..", "..")
  }

  async cancel(): Promise<void> {
    if (this.runningProcess) {
      this.runningProcess.kill("SIGTERM")
      setTimeout(() => {
        if (this.runningProcess && !this.runningProcess.killed) {
          this.runningProcess.kill("SIGKILL")
        }
      }, 2000)
      this.runningProcess = null
    }
  }
}
