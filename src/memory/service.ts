import { readdirSync, readFileSync, statSync, existsSync } from "fs"
import { join, relative, extname } from "path"
import { createHash } from "crypto"
import type { Store } from "../store.js"

const INDEXABLE_EXTENSIONS = new Set([".md", ".txt", ".json", ".yaml", ".yml"])

export class MemoryService {
  constructor(
    private store: Store,
    private baseDir: string,
  ) {}

  reconcile(): { indexed: number; pruned: number } {
    let indexed = 0
    const existingPaths = new Set<string>()

    // Scan memory directory
    if (existsSync(this.baseDir)) {
      this.scanDir(this.baseDir, "project", "", existingPaths)
      indexed = existingPaths.size
    }

    return { indexed, pruned: 0 }
  }

  private scanDir(dir: string, scope: string, scopeId: string, seen: Set<string>): void {
    try {
      const entries = readdirSync(dir)
      for (const entry of entries) {
        const fullPath = join(dir, entry)
        try {
          const stat = statSync(fullPath)
          if (stat.isDirectory()) {
            this.scanDir(fullPath, scope, entry, seen)
          } else if (INDEXABLE_EXTENSIONS.has(extname(entry).toLowerCase())) {
            this.indexFile(fullPath, scope, scopeId, stat, seen)
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  private indexFile(filePath: string, scope: string, scopeId: string, stat: any, seen: Set<string>): void {
    const fingerprint = `${stat.size}-${stat.mtimeMs}`
    const relPath = relative(this.baseDir, filePath)
    seen.add(relPath)

    try {
      const body = readFileSync(filePath, "utf-8")
      if (body.trim().length === 0) return

      this.store.upsertMemory({
        path: relPath,
        scope,
        scopeId,
        type: this.inferType(filePath),
        body,
        fingerprint,
      })
    } catch { /* skip */ }
  }

  private inferType(filePath: string): string {
    const name = filePath.toLowerCase()
    if (name.includes("checkpoint")) return "checkpoint"
    if (name.includes("memory")) return "memory"
    if (name.includes("notes")) return "notes"
    if (name.includes("progress")) return "progress"
    if (name.includes("skill")) return "skill"
    if (name.endsWith(".json")) return "data"
    return "document"
  }

  search(query: string, opts?: { scope?: string; agentId?: string; limit?: number }) {
    return this.store.searchMemory({
      query,
      scope: opts?.scope,
      agentId: opts?.agentId,
      limit: opts?.limit,
    })
  }
}
