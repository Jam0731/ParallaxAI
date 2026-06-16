import { writeFileSync, readFileSync, mkdirSync, existsSync } from "fs"
import { join } from "path"
import type { Message, AgentId } from "../types.js"

const CHECKPOINT_TEMPLATE = `# Session Checkpoint

## Active Intent
{intent}

## Recent Messages
{messages}

## Key Decisions
{decisions}

## Open Tasks
{tasks}
`

export class CheckpointManager {
  constructor(private baseDir: string) {}

  writeCheckpoint(params: {
    conversationId: string
    agentId: AgentId
    intent: string
    messages: Message[]
    decisions?: string[]
    tasks?: string[]
  }): void {
    const dir = this.getCheckpointDir(params.conversationId, params.agentId)
    mkdirSync(dir, { recursive: true })

    const content = CHECKPOINT_TEMPLATE
      .replace("{intent}", params.intent || "No active intent")
      .replace("{messages}", this.formatMessages(params.messages.slice(-10)))
      .replace("{decisions}", (params.decisions ?? ["None"]).map(d => `- ${d}`).join("\n"))
      .replace("{tasks}", (params.tasks ?? ["None"]).map(t => `- ${t}`).join("\n"))

    writeFileSync(join(dir, "checkpoint.md"), content, "utf-8")
  }

  readCheckpoint(conversationId: string, agentId: AgentId): string | undefined {
    const path = join(this.getCheckpointDir(conversationId, agentId), "checkpoint.md")
    if (!existsSync(path)) return undefined
    try {
      return readFileSync(path, "utf-8")
    } catch {
      return undefined
    }
  }

  writeNote(conversationId: string, agentId: AgentId, note: string): void {
    const dir = this.getCheckpointDir(conversationId, agentId)
    mkdirSync(dir, { recursive: true })
    const path = join(dir, "notes.md")
    const timestamp = new Date().toISOString()
    const existing = existsSync(path) ? readFileSync(path, "utf-8") : ""
    const entry = `\n\n## [${timestamp}]\n${note}`
    writeFileSync(path, existing + entry, "utf-8")
  }

  private getCheckpointDir(conversationId: string, agentId: AgentId): string {
    return join(this.baseDir, "conversations", conversationId, "agents", agentId)
  }

  private formatMessages(messages: Message[]): string {
    return messages.map(m => {
      const agent = m.agentId ? ` [${m.agentId}]` : ""
      const content = m.content.length > 200 ? m.content.slice(0, 200) + "..." : m.content
      return `- **${m.role}${agent}**: ${content}`
    }).join("\n")
  }
}
