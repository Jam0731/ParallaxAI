import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "fs"
import { join } from "path"
import type { Store } from "../store.js"

const DREAM_INTERVAL_DAYS = 7

export interface DreamResult {
  entriesAdded: number
  entriesMerged: number
  entriesPruned: number
  durationMs: number
}

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

    const compressed = this.smartCompress(memoryPath)

    this.recordDreamRun(start, consolidated.added, consolidated.merged, compressed)

    return {
      entriesAdded: consolidated.added,
      entriesMerged: consolidated.merged,
      entriesPruned: compressed,
      durationMs: Date.now() - start,
    }
  }

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

  private consolidate(sources: Array<{ path: string; content: string }>): { text: string; added: number; merged: number } {
    const entries: string[] = []
    let added = 0
    let merged = 0

    for (const source of sources) {
      if (source.path.endsWith("MEMORY.md")) continue
      const lines = source.content.split("\n").filter(l => l.trim().length > 0)
      if (lines.length === 0) continue

      const facts = lines.filter(l => !l.startsWith("#") && l.trim().length > 10)
      if (facts.length > 0) {
        entries.push(`## ${source.path.split("/").pop()}\n${facts.slice(0, 5).join("\n")}`)
        added += facts.length
        merged++
      }
    }

    return { text: entries.join("\n\n"), added, merged }
  }

  private analyzePerformance(): string {
    const stats = this.store.getPerformanceStats()
    if (stats.length === 0) return ""

    const lines: string[] = ["## Agent Performance Insights"]
    for (const stat of stats) {
      const rate = (stat.successRate * 100).toFixed(0)
      lines.push(`- ${stat.agentId}/${stat.taskType}: ${rate}% success, avg ${Math.round(stat.avgDurationMs)}ms, ${stat.totalTasks} tasks`)
    }
    return lines.join("\n")
  }

  private mergeMemory(existing: string, consolidated: string, perfInsights: string): string {
    const parts: string[] = []
    if (existing) parts.push(existing)
    if (consolidated) parts.push(`\n\n---\n\n## Auto-Dream Consolidation (${new Date().toISOString()})\n\n${consolidated}`)
    if (perfInsights) parts.push(`\n\n${perfInsights}`)
    return parts.join("")
  }

  private smartCompress(path: string): number {
    const content = readFileSync(path, "utf-8")
    const lines = content.split("\n")
    if (lines.length <= 200) return 0

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

    const MAX_SECTIONS = 20
    if (sections.length <= MAX_SECTIONS) return 0

    const recent = sections.slice(-MAX_SECTIONS)
    const older = sections.slice(0, -MAX_SECTIONS)

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

  private getLastDreamRun(): { completedAt: number } | undefined {
    const row = this.store.db.prepare(
      "SELECT completed_at FROM dream_runs WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1"
    ).get() as any
    return row ? { completedAt: row.completed_at } : undefined
  }

  private recordDreamRun(start: number, added: number, merged: number, pruned: number): void {
    this.store.db.prepare(
      `INSERT INTO dream_runs (started_at, completed_at, status, entries_added, entries_merged, entries_pruned)
       VALUES (?, ?, 'completed', ?, ?, ?)`
    ).run(start, Date.now(), added, merged, pruned)
  }
}
