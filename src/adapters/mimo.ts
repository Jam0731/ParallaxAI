import { spawn, execSync, type ChildProcess } from "child_process"
import { join, dirname } from "path"
import { existsSync } from "fs"
import { fileURLToPath } from "url"
import { EventEmitter } from "events"
import type {
  AgentAdapter, AgentChunk, AgentResponse, AgentTask,
  AdapterConfig, DetectResult, HealthStatus, UsageInfo,
} from "../types.js"

export class MimoAdapter extends EventEmitter implements AgentAdapter {
  readonly id = "mimo"
  readonly name = "MiMo Code"
  readonly capabilities = ["code", "review", "research"]
  private command = process.env.MIMO_PATH ?? "mimo"
  private config: AdapterConfig = {}
  private runningProcess: ChildProcess | null = null

  async detect(): Promise<DetectResult> {
    try {
      const output = execSync(`${this.command} --version`, { timeout: 5_000, encoding: "utf-8" }).trim()
      return { found: true, version: output }
    } catch {
      return { found: false, error: "mimo not found" }
    }
  }

  async initialize(config: AdapterConfig = {}): Promise<void> {
    this.config = config
  }

  async shutdown(): Promise<void> {
    await this.cancel()
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      execSync(`${this.command} --version`, { timeout: 5_000 })
      return { healthy: true }
    } catch {
      return { healthy: false, lastError: "mimo not responding" }
    }
  }

  async run(task: AgentTask): Promise<AgentResponse> {
    const start = Date.now()
    const chunks: string[] = []
    let usage: UsageInfo | undefined
    let capturedSessionId: string | undefined

    const message = task.context
      ? `${task.context}\n\n---\n\n${task.message}`
      : task.message

    const args: string[] = ["run", message, "--format", "json"]

    if (task.sessionId) args.push("-s", task.sessionId)
    if (task.workDir) args.push("--dir", task.workDir)
    if (this.config.model) args.push("-m", this.config.model)

    const agentConfigDir = task.agentId
      ? join(this.getProjectDir(), "agent-configs", task.agentId)
      : undefined
    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      ...this.config.env,
      MIMOCODE_CLIENT: "parallax",
    }
    if (agentConfigDir && existsSync(agentConfigDir)) {
      env.MIMOCODE_CONFIG_DIR = agentConfigDir
      console.log(`[mimo-adapter] MIMOCODE_CONFIG_DIR=${agentConfigDir}`)
    } else {
      console.log(`[mimo-adapter] WARNING: agent-configs dir not found: ${agentConfigDir}`)
    }

    const child = spawn(this.command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: task.workDir,
      env,
    })

    this.runningProcess = child
    child.stderr?.on("data", () => {})

    let done = false
    const rl = (await import("readline")).createInterface({ input: child.stdout! })
    const timeout = setTimeout(() => {
      if (!done) { done = true; child.kill("SIGTERM"); rl.close() }
    }, task.timeout ?? 120_000)

    try {
      for await (const line of rl) {
        if (done) break
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          if (event.sessionID) capturedSessionId = event.sessionID

          // Capture text from various event formats
          if (event.type === "text" && event.part?.text) {
            chunks.push(event.part.text)
          } else if (event.type === "text" && typeof event.text === "string") {
            chunks.push(event.text)
          } else if (event.type === "assistant" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "text" && block.text) chunks.push(block.text)
            }
          } else if (event.type === "result" && event.result) {
            chunks.push(event.result)
          }

          if (event.type === "step-finish" || event.type === "step_finish") {
            const reason = event.part?.reason
            if (event.part?.tokens) {
              usage = {
                inputTokens: event.part.tokens.input ?? 0,
                outputTokens: event.part.tokens.output ?? 0,
                totalTokens: event.part.tokens.total ?? 0,
                costUsd: event.part?.cost ?? 0,
                durationMs: Date.now() - start,
              }
            }
            if (reason === "stop" || reason === "end_turn") {
              done = true
              child.kill("SIGTERM")
              break
            }
          }
        } catch { /* ignore */ }
      }
    } finally {
      clearTimeout(timeout)
      if (!done) child.kill("SIGTERM")
      this.runningProcess = null
    }

    const finalText = chunks.join("")
    console.log(`[mimo-adapter] chunks: ${chunks.length}, text: ${finalText.length} chars, sessionId: ${capturedSessionId}`)
    if (finalText.length === 0) {
      console.log(`[mimo-adapter] WARNING: empty response after ${Date.now() - start}ms`)
    }
    return {
      text: finalText,
      usage: usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0, durationMs: Date.now() - start },
      stopReason: "end_turn",
      durationMs: Date.now() - start,
      sessionId: capturedSessionId,
    }
  }

  async *runStream(task: AgentTask): AsyncIterable<AgentChunk> {
    const result = await this.run(task)
    if (result.text) yield { type: "text", content: result.text }
    if (result.usage) yield { type: "usage", usage: result.usage }
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

  private getProjectDir(): string {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    return join(__dirname, "..", "..")
  }
}
