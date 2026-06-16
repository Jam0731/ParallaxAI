import type { AgentId, RoutingDecision, DelegationTask } from "./types.js"

const MENTION_REGEX = /@(munger|woz|ogilvy|taleb)(?:\b|$)/gi
const DELEGATION_REGEX = /@(woz|ogilvy|taleb)\s+(.+?)(?=\n@|\n\n|$)/gs

export function routeMessage(content: string): RoutingDecision {
  const mentions = [...content.matchAll(MENTION_REGEX)]

  if (mentions.length === 1) {
    const target = mentions[0]![1]!.toLowerCase() as AgentId
    const cleaned = content.replace(/@\w+/g, "").trim()
    return {
      targetAgent: target,
      directMessage: cleaned || content,
      isExplicitMention: true,
      isDebate: false,
    }
  }

  if (mentions.length > 1) {
    return {
      targetAgent: "munger",
      directMessage: content,
      isExplicitMention: false,
      isDebate: true,
    }
  }

  return {
    targetAgent: "munger",
    directMessage: content,
    isExplicitMention: false,
    isDebate: false,
  }
}

export function parseDelegations(reply: string): DelegationTask[] {
  const delegations: DelegationTask[] = []

  // Split by @agent mentions and extract task for each
  const parts = reply.split(/(?=@(woz|ogilvy|taleb)\b)/)

  for (const part of parts) {
    const match = part.match(/^@(woz|ogilvy|taleb)\s+([\s\S]+?)(?=\s*@(?:woz|ogilvy|taleb)\b|$)/)
    if (match) {
      const task = match[2]!.trim()
      if (task.length > 0) {
        delegations.push({
          target: match[1]!.toLowerCase() as AgentId,
          task,
        })
      }
    }
  }

  // Fallback: bare @mention with surrounding context
  if (delegations.length === 0) {
    const bareMentions = [...reply.matchAll(/@(woz|ogilvy|taleb)/gi)]
    for (const m of bareMentions) {
      const target = m[1]!.toLowerCase() as AgentId
      const idx = m.index!
      const before = reply.slice(Math.max(0, idx - 100), idx).trim()
      const after = reply.slice(idx + m[0].length, idx + m[0].length + 200).trim()
      const task = `${before} ${after}`.trim() || "请加入对话"
      delegations.push({ target, task })
    }
  }

  return delegations
}

export class LoopDetector {
  private depth = new Map<string, number>()
  private recent: Array<{ from: string; to: string; ts: number }> = []
  private readonly MAX_DEPTH = 3
  private readonly LOOP_WINDOW_MS = 30_000
  private readonly LOOP_THRESHOLD = 4

  check(conversationId: string, from: string, to: string): boolean {
    const currentDepth = this.depth.get(conversationId) ?? 0
    if (currentDepth >= this.MAX_DEPTH) return true

    const now = Date.now()
    this.recent = this.recent.filter(m => now - m.ts < this.LOOP_WINDOW_MS)
    this.recent.push({ from, to, ts: now })

    const backAndForth = this.recent.filter(
      m => (m.from === to && m.to === from) || (m.from === from && m.to === to)
    )
    return backAndForth.length >= this.LOOP_THRESHOLD
  }

  incrementDepth(conversationId: string): number {
    const current = (this.depth.get(conversationId) ?? 0) + 1
    this.depth.set(conversationId, current)
    return current
  }

  resetDepth(conversationId: string): void {
    this.depth.delete(conversationId)
  }
}
