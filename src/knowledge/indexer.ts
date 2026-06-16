import { readdirSync, readFileSync, statSync, existsSync } from "fs"
import { join, extname, relative } from "path"
import { createHash } from "crypto"
import type { Store } from "../store.js"

const SUPPORTED_EXTENSIONS = new Set([".md", ".txt", ".json", ".yaml", ".yml", ".ts", ".tsx", ".js", ".jsx"])
const CHUNK_SIZE = 500  // tokens per chunk
const CHUNK_OVERLAP = 50

export interface KnowledgeDocument {
  id: string
  source: "local" | "github_wiki" | "url"
  title: string
  path?: string
  content: string
  contentHash: string
  mimeType?: string
  chunkCount: number
}

export interface KnowledgeChunk {
  id: string
  documentId: string
  chunkIndex: number
  content: string
  tokenCount: number
}

export interface KnowledgeResult {
  documentId: string
  title: string
  source: string
  chunkContent: string
  score: number
}

export class KnowledgeIndexer {
  constructor(private store: Store) {}

  indexDirectory(dir: string, source: "local" = "local"): number {
    if (!existsSync(dir)) return 0

    let indexed = 0
    const scan = (currentDir: string) => {
      try {
        for (const entry of readdirSync(currentDir)) {
          const fullPath = join(currentDir, entry)
          try {
            const stat = statSync(fullPath)
            if (stat.isDirectory() && !entry.startsWith(".") && entry !== "node_modules") {
              scan(fullPath)
            } else if (stat.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry).toLowerCase())) {
              this.indexFile(fullPath, source, dir)
              indexed++
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }

    scan(dir)
    return indexed
  }

  indexFile(filePath: string, source: string, baseDir: string): void {
    try {
      const content = readFileSync(filePath, "utf-8")
      if (content.trim().length < 20) return

      const contentHash = createHash("sha256").update(content).digest("hex").slice(0, 16)
      const relPath = relative(baseDir, filePath)
      const title = relPath.split("/").pop() ?? relPath

      // Check if already indexed with same hash
      const existing = this.store.db.prepare(
        "SELECT content_hash FROM knowledge_documents WHERE path = ?"
      ).get(filePath) as any
      if (existing?.content_hash === contentHash) return

      // Upsert document
      this.store.db.prepare(
        `INSERT INTO knowledge_documents (id, source, title, path, content, content_hash, chunk_count, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           content = excluded.content, content_hash = excluded.content_hash,
           chunk_count = excluded.chunk_count, indexed_at = excluded.indexed_at`
      ).run(filePath, source, title, filePath, content, contentHash, 0, Date.now())

      // Chunk and index
      const chunks = this.chunkText(content)
      this.store.db.prepare("DELETE FROM knowledge_chunks WHERE document_id = ?").run(filePath)
      for (let i = 0; i < chunks.length; i++) {
        this.store.db.prepare(
          `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, token_count)
           VALUES (?, ?, ?, ?, ?)`
        ).run(`${filePath}:${i}`, filePath, i, chunks[i], this.estimateTokens(chunks[i]))
      }

      this.store.db.prepare(
        "UPDATE knowledge_documents SET chunk_count = ? WHERE id = ?"
      ).run(chunks.length, filePath)
    } catch { /* skip */ }
  }

  query(input: { query: string; limit?: number }): KnowledgeResult[] {
    const limit = input.limit ?? 10
    const ftsQuery = this.buildFtsQuery(input.query)
    if (!ftsQuery) return []

    const rows = this.store.db.prepare(`
      SELECT kc.document_id, kd.title, kd.source, kc.content as chunk_content,
             bm25(knowledge_fts_idx) AS score
      FROM knowledge_fts_idx
      JOIN knowledge_chunks kc ON kc.id = (
        SELECT id FROM knowledge_chunks WHERE document_id = kc.document_id AND chunk_index = 0
      )
      JOIN knowledge_documents kd ON kd.id = kc.document_id
      WHERE knowledge_fts_idx MATCH ?
      ORDER BY score
      LIMIT ?
    `).all(ftsQuery, limit) as any[]

    return rows.map(r => ({
      documentId: r.document_id,
      title: r.title,
      source: r.source,
      chunkContent: r.chunk_content?.slice(0, 500) ?? "",
      score: -(r.score ?? 0),
    }))
  }

  private chunkText(text: string): string[] {
    const words = text.split(/\s+/)
    const chunks: string[] = []
    const wordsPerChunk = Math.floor(CHUNK_SIZE * 4 / 5) // ~400 words per chunk
    const overlapWords = Math.floor(CHUNK_OVERLAP * 4 / 5)

    let i = 0
    while (i < words.length) {
      const chunk = words.slice(i, i + wordsPerChunk).join(" ")
      if (chunk.trim().length > 0) chunks.push(chunk)
      i += wordsPerChunk - overlapWords
    }

    return chunks.length > 0 ? chunks : [text.slice(0, 2000)]
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  private buildFtsQuery(input: string): string {
    const tokens = input.replace(/[^\w\s]/g, " ").trim().split(/\s+/).filter(t => t.length > 1)
    if (tokens.length === 0) return ""
    return tokens.map(t => `"${t}"`).join(" OR ")
  }

  getStats(): { documents: number; chunks: number } {
    const docs = this.store.db.prepare("SELECT COUNT(*) as cnt FROM knowledge_documents").get() as any
    const chunks = this.store.db.prepare("SELECT COUNT(*) as cnt FROM knowledge_chunks").get() as any
    return { documents: docs?.cnt ?? 0, chunks: chunks?.cnt ?? 0 }
  }
}
