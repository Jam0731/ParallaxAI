import type { Message, AgentId } from "../types.js"

// Pressure levels (from MiMo Code)
const PRESSURE_0 = 0.5  // <50% → no compaction
const PRESSURE_1 = 0.7  // 50-70% → soft warning
const PRESSURE_2 = 0.85 // 70-85% → compact old messages
const PRESSURE_3 = 1.0  // >85% → force compact + checkpoint

const PRUNE_MINIMUM = 20_000    // Minimum tokens before pruning activates
const PRUNE_PROTECT = 40_000    // Recent tokens protected from pruning
const DEFAULT_TAIL_TURNS = 2    // Recent user turns always preserved

export interface CompactionResult {
  compacted: boolean
  summary?: string
  preservedMessages: Message[]
  pressureLevel: number
}

export class ContextCompaction {
  private contextWindows: Record<string, number> = {
    "claude": 200_000,
    "mimo": 1_000_000,
    "reasonix": 200_000,
    "default": 200_000,
  }

  setContextWindow(adapterId: string, tokens: number): void {
    this.contextWindows[adapterId] = tokens
  }

  estimateTokens(messages: Message[]): number {
    // Rough estimate: 1 token ≈ 4 characters
    return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0)
  }

  getPressureLevel(messages: Message[], adapterId: string): number {
    const tokens = this.estimateTokens(messages)
    const window = this.contextWindows[adapterId] ?? this.contextWindows["default"]
    return tokens / window
  }

  shouldCompact(messages: Message[], adapterId: string): boolean {
    const pressure = this.getPressureLevel(messages, adapterId)
    return pressure >= PRESSURE_2
  }

  compact(messages: Message[], adapterId: string): CompactionResult {
    const pressure = this.getPressureLevel(messages, adapterId)

    if (pressure < PRESSURE_1) {
      return { compacted: false, preservedMessages: messages, pressureLevel: pressure }
    }

    if (pressure < PRESSURE_2) {
      // Soft warning only
      return { compacted: false, preservedMessages: messages, pressureLevel: pressure }
    }

    // Find the boundary: keep recent turns, summarize old ones
    const userTurns = messages.filter(m => m.role === "user")
    const protectCount = Math.min(DEFAULT_TAIL_TURNS, userTurns.length)

    // Find the message index where the protected tail starts
    let protectedStartIdx = messages.length
    if (protectCount > 0) {
      const lastUserTurn = userTurns[userTurns.length - protectCount]
      protectedStartIdx = messages.indexOf(lastUserTurn)
    }

    // Ensure we don't prune too little
    const oldMessages = messages.slice(0, protectedStartIdx)
    const oldTokens = this.estimateTokens(oldMessages)
    if (oldTokens < PRUNE_MINIMUM) {
      return { compacted: false, preservedMessages: messages, pressureLevel: pressure }
    }

    // Generate summary of old messages
    const summary = this.summarizeOld(oldMessages)
    const preservedMessages = messages.slice(protectedStartIdx)

    return {
      compacted: true,
      summary,
      preservedMessages,
      pressureLevel: pressure,
    }
  }

  prepareDelegationContext(fromMessages: Message[], task: string, maxTokens = 2000): string {
    // Compress context for cross-agent delegation
    const recent = fromMessages.slice(-5)
    const summary = recent.map(m => {
      const content = m.content.length > 300 ? m.content.slice(0, 300) + "..." : m.content
      return `[${m.role}]: ${content}`
    }).join("\n")

    // Truncate to maxTokens
    const estimated = Math.ceil(summary.length / 4)
    if (estimated > maxTokens) {
      const ratio = maxTokens / estimated
      return summary.slice(0, Math.floor(summary.length * ratio)) + "\n...(truncated)"
    }
    return summary
  }

  private summarizeOld(messages: Message[]): string {
    // Simple extractive summary: keep first and last message of each role
    const byRole = new Map<string, Message[]>()
    for (const m of messages) {
      const list = byRole.get(m.role) ?? []
      list.push(m)
      byRole.set(m.role, list)
    }

    const parts: string[] = []
    for (const [role, msgs] of byRole) {
      const first = msgs[0]
      const last = msgs[msgs.length - 1]
      if (first === last) {
        parts.push(`[${role}]: ${first.content.slice(0, 150)}...`)
      } else {
        parts.push(`[${role} start]: ${first.content.slice(0, 100)}...`)
        parts.push(`[${role} end]: ${last.content.slice(0, 100)}...`)
      }
    }

    return `[Context summary of ${messages.length} messages]\n${parts.join("\n")}`
  }
}
