import { readFileSync, existsSync, readdirSync } from "fs"
import { join } from "path"
import { createHash } from "crypto"
import type { AgentId, ContextBundle, Message } from "./types.js"

export class ContextManager {
  constructor(
    private agentConfigsDir: string,
    private sharedMemoryDir: string,
    private dataDir: string,
  ) {}

  buildContextBundle(params: {
    agentId: AgentId
    conversationId: string
    history?: Message[]
    delegatingAgent?: AgentId
    delegationTask?: string
    workspaceId?: string
  }): ContextBundle {
    const agentPersona = this.loadAgentPersona(params.agentId)
    const sharedContext = this.loadSharedContext(params.workspaceId)
    const conversationSummary = this.buildConversationSummary(params.history)

    const crossAgentContext = this.buildCrossAgentContext(
      params.delegatingAgent,
      params.agentId,
      params.delegationTask,
      params.history,
    )

    return { agentPersona, sharedContext, conversationSummary, crossAgentContext }
  }

  getVersionHash(bundle: ContextBundle): string {
    const content = [
      bundle.agentPersona ?? "",
      bundle.sharedContext ?? "",
    ].join("||")
    return createHash("md5").update(content).digest("hex")
  }

  private loadAgentPersona(agentId: string): string | undefined {
    const agentsPath = join(this.agentConfigsDir, agentId, "AGENTS.md")
    if (!existsSync(agentsPath)) return undefined
    try {
      return readFileSync(agentsPath, "utf-8")
    } catch {
      return undefined
    }
  }

  private loadSharedContext(workspaceId?: string): string | undefined {
    const parts: string[] = []

    // Load from shared_memory/ directory (legacy business data)
    if (existsSync(this.sharedMemoryDir)) {
      const files = readdirSync(this.sharedMemoryDir).filter(f => f.endsWith(".json"))
      for (const file of files) {
        try {
          const content = readFileSync(join(this.sharedMemoryDir, file), "utf-8")
          const data = JSON.parse(content)
          const name = file.replace(".json", "")
          parts.push(`### ${name}\n${JSON.stringify(data, null, 2)}`)
        } catch { /* skip */ }
      }
    }

    // Load shared_context.json from workspace directory
    if (workspaceId) {
      const sharedContextPath = join(this.dataDir, "workspaces", workspaceId, "shared_context.json")
      if (existsSync(sharedContextPath)) {
        try {
          const ctx = JSON.parse(readFileSync(sharedContextPath, "utf-8"))
          if (ctx.team_status?.entries?.length > 0) {
            const entries = ctx.team_status.entries
              .slice(-10)
              .map((e: any) => `- ${e.content}`)
              .join("\n")
            parts.push(`### Team Status (updated by ${ctx.team_status.updatedBy})\n${entries}`)
          }
        } catch { /* skip */ }
      }
    }

    return parts.length > 0 ? parts.join("\n\n") : undefined
  }

  private buildConversationSummary(history?: Message[]): string | undefined {
    if (!history || history.length === 0) return undefined
    const recent = history.slice(-20)
    return recent.map(m => {
      const agent = m.agentId ? ` [${m.agentId}]` : ""
      const content = m.content.length > 800 ? m.content.slice(0, 800) + "..." : m.content
      return `${m.role}${agent}: ${content}`
    }).join("\n")
  }

  private buildCrossAgentContext(
    from: AgentId | undefined,
    to: AgentId,
    task: string | undefined,
    history?: Message[],
  ): string | undefined {
    if (!history || history.length === 0) return undefined

    // Get other agents' recent responses
    const otherAgentMessages = history
      .filter(m => m.agentId && m.agentId !== to && m.role === 'assistant')
      .slice(-5)

    // Also get user messages that mention other agents (context clues)
    const userMentions = history
      .filter(m => m.role === 'user' && /@(woz|ogilvy|taleb|munger)/.test(m.content))
      .slice(-3)

    if (otherAgentMessages.length === 0 && !from) return undefined

    const parts: string[] = []

    // Delegation context (when Munger delegates)
    if (from && task) {
      parts.push(`## Context from ${from}`)
      parts.push(`Task: ${task}`)

      const fromMessages = history.filter(m => m.agentId === from)
      const lastFromMessage = fromMessages[fromMessages.length - 1]
      if (lastFromMessage) {
        parts.push(`## ${from}'s full message:\n${lastFromMessage.content}`)
      }
    }

    // Other agents' responses — always include when available
    if (otherAgentMessages.length > 0) {
      parts.push(`## Other agents' recent responses (for your reference):`)
      for (const msg of otherAgentMessages) {
        const preview = msg.content.length > 1000 ? msg.content.slice(0, 1000) + "..." : msg.content
        parts.push(`### ${msg.agentId}:\n${preview}`)
      }
    }

    return parts.length > 0 ? parts.join("\n\n") : undefined
  }

  formatForPrompt(bundle: ContextBundle): string {
    const parts: string[] = []
    if (bundle.agentPersona) parts.push(`## Your Role\n${bundle.agentPersona}`)
    if (bundle.sharedContext) parts.push(`## Shared Context\n${bundle.sharedContext}`)
    if (bundle.conversationSummary) parts.push(`## Recent Conversation\n${bundle.conversationSummary}`)
    if (bundle.crossAgentContext) parts.push(bundle.crossAgentContext)
    return parts.join("\n\n")
  }
}
