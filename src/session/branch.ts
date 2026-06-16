import { nanoid } from "nanoid"
import type { Store } from "../store.js"

export class BranchManager {
  constructor(private store: Store) {}

  createBranch(conversationId: string, fromMessageId: string, name: string): string {
    const branchId = nanoid(10)
    this.store.db.prepare(
      `INSERT INTO branches (id, conversation_id, name, fork_point, created_at, is_active)
       VALUES (?, ?, ?, ?, ?, 0)`
    ).run(branchId, conversationId, name, fromMessageId, Date.now())
    return branchId
  }

  switchBranch(conversationId: string, branchId: string): void {
    // Deactivate all branches for this conversation
    this.store.db.prepare(
      `UPDATE branches SET is_active = 0 WHERE conversation_id = ?`
    ).run(conversationId)

    // Activate the target branch
    this.store.db.prepare(
      `UPDATE branches SET is_active = 1 WHERE id = ? AND conversation_id = ?`
    ).run(branchId, conversationId)

    // Update conversation's active branch
    this.store.db.prepare(
      `UPDATE conversations SET active_branch = ? WHERE id = ?`
    ).run(branchId, conversationId)
  }

  getBranches(conversationId: string): Array<{
    id: string; name: string; forkPoint: string; isActive: boolean; messageCount: number
  }> {
    const rows = this.store.db.prepare(`
      SELECT b.id, b.name, b.fork_point, b.is_active,
             COUNT(m.id) as msg_count
      FROM branches b
      LEFT JOIN messages m ON m.conversation_id = b.conversation_id
        AND (m.branch_id = b.id OR m.branch_id = 'main')
        AND m.created_at >= (SELECT created_at FROM messages WHERE id = b.fork_point)
      WHERE b.conversation_id = ?
      GROUP BY b.id
      ORDER BY b.created_at ASC
    `).all(conversationId) as any[]

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      forkPoint: r.fork_point,
      isActive: r.is_active === 1,
      messageCount: r.msg_count,
    }))
  }

  getVisibleMessages(conversationId: string, branchId?: string) {
    // Messages before fork point are shared across all branches
    // Messages after fork point are branch-specific
    if (!branchId || branchId === "main") {
      return this.store.getMessages(conversationId, "main")
    }

    const branch = this.store.db.prepare(
      `SELECT fork_point FROM branches WHERE id = ? AND conversation_id = ?`
    ).get(branchId, conversationId) as any

    if (!branch) return this.store.getMessages(conversationId, "main")

    const forkTime = this.store.db.prepare(
      `SELECT created_at FROM messages WHERE id = ?`
    ).get(branch.fork_point) as any

    if (!forkTime) return this.store.getMessages(conversationId, "main")

    // Get shared messages (before fork) + branch-specific messages
    const rows = this.store.db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
        AND (created_at < ? OR branch_id = ?)
      ORDER BY created_at ASC
    `).all(conversationId, forkTime.created_at, branchId) as any[]

    return rows.map(r => this.store["rowToMessage"](r))
  }

  mergeBranch(fromBranchId: string, toBranchId: string): void {
    // Cherry-pick: copy messages from source branch to target
    const fromMessages = this.store.db.prepare(
      `SELECT * FROM messages WHERE branch_id = ? ORDER BY created_at ASC`
    ).all(fromBranchId) as any[]

    for (const msg of fromMessages) {
      this.store.db.prepare(
        `INSERT OR IGNORE INTO messages (id, conversation_id, branch_id, role, agent_id, adapter_id, content, metadata, created_at, tokens_used, cost_usd)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(msg.id, msg.conversation_id, toBranchId, msg.role, msg.agent_id,
        msg.adapter_id, msg.content, msg.metadata, msg.created_at,
        msg.tokens_used, msg.cost_usd)
    }
  }
}
