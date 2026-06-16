import type { AgentId, CostEntry } from "../types.js"
import type { Store } from "../store.js"

export interface BudgetConfig {
  id: string
  scope: "global" | "agent" | "daily" | "monthly"
  scopeId?: string
  amountUsd: number
  period?: "daily" | "weekly" | "monthly"
  alertAt: number // 0.0-1.0, default 0.8
}

export interface CostSummary {
  totalUsd: number
  entries: number
  byAgent: Record<string, { usd: number; tokens: number }>
  byDay: Record<string, number>
}

export class CostTracker {
  private budgets: BudgetConfig[] = []
  private alertListeners: Array<(alert: string) => void> = []

  constructor(private store: Store) {}

  loadBudgets(): void {
    const rows = this.store.db.prepare("SELECT * FROM budgets").all() as any[]
    this.budgets = rows.map(r => ({
      id: r.id,
      scope: r.scope,
      scopeId: r.scope_id ?? undefined,
      amountUsd: r.amount_usd,
      period: r.period ?? undefined,
      alertAt: r.alert_at,
    }))
  }

  addBudget(config: BudgetConfig): void {
    this.store.db.prepare(
      `INSERT OR REPLACE INTO budgets (id, scope, scope_id, amount_usd, period, alert_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(config.id, config.scope, config.scopeId ?? null, config.amountUsd,
      config.period ?? null, config.alertAt, Date.now(), Date.now())
    this.budgets.push(config)
  }

  onAlert(listener: (alert: string) => void): void {
    this.alertListeners.push(listener)
  }

  async record(entry: CostEntry): Promise<void> {
    this.store.recordCost(entry)
    await this.checkBudgets(entry.agentId)
  }

  private async checkBudgets(agentId: string): Promise<void> {
    for (const budget of this.budgets) {
      if (budget.scope === "agent" && budget.scopeId !== agentId) continue

      const spent = this.getSpent(budget)
      const ratio = spent / budget.amountUsd

      if (ratio >= budget.alertAt) {
        const msg = `Budget alert: ${budget.scope === "agent" ? agentId : budget.scope} at ${(ratio * 100).toFixed(0)}% ($${spent.toFixed(2)} / $${budget.amountUsd})`
        for (const listener of this.alertListeners) {
          listener(msg)
        }
      }
    }
  }

  private getSpent(budget: BudgetConfig): number {
    let sql = "SELECT COALESCE(SUM(cost_usd), 0) as total FROM cost_entries WHERE 1=1"
    const params: any[] = []

    if (budget.scope === "agent" && budget.scopeId) {
      sql += " AND agent_id = ?"
      params.push(budget.scopeId)
    }

    if (budget.period === "daily") {
      sql += " AND created_at > unixepoch() * 1000 - 86400000"
    } else if (budget.period === "weekly") {
      sql += " AND created_at > unixepoch() * 1000 - 604800000"
    } else if (budget.period === "monthly") {
      sql += " AND created_at > unixepoch() * 1000 - 2592000000"
    }

    const row = this.store.db.prepare(sql).get(...params) as any
    return row?.total ?? 0
  }

  getSummary(opts?: { agentId?: string; period?: "daily" | "weekly" | "monthly" }): CostSummary {
    const agentId = opts?.agentId
    const period = opts?.period

    let whereClause = "1=1"
    const params: any[] = []
    if (agentId) { whereClause += " AND agent_id = ?"; params.push(agentId) }
    if (period === "daily") whereClause += " AND created_at > unixepoch() * 1000 - 86400000"
    if (period === "weekly") whereClause += " AND created_at > unixepoch() * 1000 - 604800000"
    if (period === "monthly") whereClause += " AND created_at > unixepoch() * 1000 - 2592000000"

    const total = this.store.db.prepare(
      `SELECT COALESCE(SUM(cost_usd), 0) as total, COUNT(*) as cnt FROM cost_entries WHERE ${whereClause}`
    ).get(...params) as any

    const byAgent = this.store.db.prepare(
      `SELECT agent_id, SUM(cost_usd) as usd, SUM(input_tokens + output_tokens) as tokens
       FROM cost_entries WHERE ${whereClause} GROUP BY agent_id`
    ).all(...params) as any[]

    const byDay = this.store.db.prepare(
      `SELECT date(created_at / 1000, 'unixepoch') as day, SUM(cost_usd) as usd
       FROM cost_entries WHERE ${whereClause} GROUP BY day ORDER BY day DESC LIMIT 30`
    ).all(...params) as any[]

    return {
      totalUsd: total.total,
      entries: total.cnt,
      byAgent: Object.fromEntries(byAgent.map(r => [r.agent_id, { usd: r.usd, tokens: r.tokens }])),
      byDay: Object.fromEntries(byDay.map(r => [r.day, r.usd])),
    }
  }
}
