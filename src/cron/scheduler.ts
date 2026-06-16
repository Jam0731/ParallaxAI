import { nanoid } from "nanoid"
import type { Store } from "../store.js"
import type { AgentId } from "../types.js"

export interface CronJob {
  id: string
  name: string
  description?: string
  scheduleType: "at" | "every" | "cron"
  scheduleValue: string
  timezone: string
  payloadType: "agent_turn" | "command"
  payloadData: Record<string, unknown>
  targetAgent?: AgentId
  enabled: boolean
}

export interface CronJobRun {
  id: string
  jobId: string
  startedAt: number
  completedAt?: number
  status: "running" | "success" | "failed"
  output?: string
  error?: string
}

export class CronScheduler {
  private timers = new Map<string, ReturnType<typeof setInterval>>()
  private jobHandlers = new Map<string, (job: CronJob) => Promise<string>>()

  constructor(private store: Store) {}

  registerHandler(payloadType: string, handler: (job: CronJob) => Promise<string>): void {
    this.jobHandlers.set(payloadType, handler)
  }

  addJob(job: Omit<CronJob, "id">): string {
    const id = nanoid(10)
    this.store.db.prepare(
      `INSERT INTO cron_jobs (id, name, description, schedule_type, schedule_value, timezone, payload_type, payload_data, target_agent, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, job.name, job.description ?? null, job.scheduleType, job.scheduleValue,
      job.timezone, job.payloadType, JSON.stringify(job.payloadData),
      job.targetAgent ?? null, job.enabled ? 1 : 0, Date.now(), Date.now())

    if (job.enabled) this.scheduleJob({ ...job, id })
    return id
  }

  start(): void {
    const jobs = this.store.db.prepare("SELECT * FROM cron_jobs WHERE enabled = 1").all() as any[]
    for (const row of jobs) {
      const job: CronJob = {
        id: row.id, name: row.name, description: row.description,
        scheduleType: row.schedule_type, scheduleValue: row.schedule_value,
        timezone: row.timezone, payloadType: row.payload_type,
        payloadData: JSON.parse(row.payload_data), targetAgent: row.target_agent ?? undefined,
        enabled: row.enabled === 1,
      }
      this.scheduleJob(job)
    }
  }

  stop(): void {
    for (const timer of this.timers.values()) clearInterval(timer)
    this.timers.clear()
  }

  private scheduleJob(job: CronJob): void {
    if (job.scheduleType === "every") {
      const ms = parseInt(job.scheduleValue)
      if (isNaN(ms)) return
      const timer = setInterval(() => this.executeJob(job), ms)
      this.timers.set(job.id, timer)
    }
    // "cron" and "at" scheduling would need a proper cron parser
    // For MVP, we support "every" (interval in ms) only
  }

  private async executeJob(job: CronJob): Promise<void> {
    const runId = nanoid(10)
    const startedAt = Date.now()

    this.store.db.prepare(
      `INSERT INTO cron_runs (id, job_id, started_at, status) VALUES (?, ?, ?, 'running')`
    ).run(runId, job.id, startedAt)

    try {
      const handler = this.jobHandlers.get(job.payloadType)
      if (!handler) throw new Error(`No handler for payload type: ${job.payloadType}`)

      const output = await handler(job)

      this.store.db.prepare(
        `UPDATE cron_runs SET completed_at = ?, status = 'success', output = ? WHERE id = ?`
      ).run(Date.now(), output, runId)

      this.store.db.prepare(
        `UPDATE cron_jobs SET last_run_at = ?, last_status = 'success', consecutive_failures = 0 WHERE id = ?`
      ).run(startedAt, job.id)
    } catch (err) {
      const error = String(err)
      this.store.db.prepare(
        `UPDATE cron_runs SET completed_at = ?, status = 'failed', error = ? WHERE id = ?`
      ).run(Date.now(), error, runId)

      this.store.db.prepare(
        `UPDATE cron_jobs SET last_run_at = ?, last_status = 'failed', last_error = ?, consecutive_failures = consecutive_failures + 1 WHERE id = ?`
      ).run(startedAt, error, job.id)
    }
  }

  listJobs(): CronJob[] {
    const rows = this.store.db.prepare("SELECT * FROM cron_jobs ORDER BY created_at ASC").all() as any[]
    return rows.map(r => ({
      id: r.id, name: r.name, description: r.description,
      scheduleType: r.schedule_type, scheduleValue: r.schedule_value,
      timezone: r.timezone, payloadType: r.payload_type,
      payloadData: JSON.parse(r.payload_data), targetAgent: r.target_agent ?? undefined,
      enabled: r.enabled === 1,
    }))
  }

  listRuns(jobId?: string): CronJobRun[] {
    let sql = "SELECT * FROM cron_runs"
    const params: any[] = []
    if (jobId) { sql += " WHERE job_id = ?"; params.push(jobId) }
    sql += " ORDER BY started_at DESC LIMIT 50"
    const rows = this.store.db.prepare(sql).all(...params) as any[]
    return rows.map(r => ({
      id: r.id, jobId: r.job_id, startedAt: r.started_at,
      completedAt: r.completed_at ?? undefined, status: r.status,
      output: r.output ?? undefined, error: r.error ?? undefined,
    }))
  }
}
