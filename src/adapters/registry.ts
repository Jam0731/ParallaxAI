import type {
  AgentAdapter, AgentId, AgentTask, AgentResponse, AgentStatus,
  DetectResult, AdapterConfig,
} from "../types.js"
import { ClaudeAdapter } from "./claude.js"
import { MimoAdapter } from "./mimo.js"
import { ReasonixAdapter } from "./reasonix.js"

export interface RoleConfig {
  name: string
  skill: string
  preferred: string
  fallback: string[]
}

export class AdapterRegistry {
  private adapters = new Map<string, AgentAdapter>()
  private roles = new Map<string, RoleConfig>()
  private statuses = new Map<string, AgentStatus>()
  private statusListeners: Array<(agentId: string, status: AgentStatus) => void> = []

  constructor(roles: Record<string, RoleConfig>) {
    for (const [id, config] of Object.entries(roles)) {
      this.roles.set(id, config)
    }
  }

  onStatusChange(listener: (agentId: string, status: AgentStatus) => void): void {
    this.statusListeners.push(listener)
  }

  private setStatus(agentId: string, status: AgentStatus): void {
    this.statuses.set(agentId, status)
    for (const listener of this.statusListeners) {
      listener(agentId, status)
    }
  }

  async detectAndRegister(config: AdapterConfig = {}): Promise<string[]> {
    const candidates = [
      new ClaudeAdapter(),
      new MimoAdapter(),
      new ReasonixAdapter(),
    ]
    const registered: string[] = []
    for (const adapter of candidates) {
      const result = await adapter.detect()
      if (result.found) {
        try {
          await adapter.initialize(config)
          this.adapters.set(adapter.id, adapter)
          this.setStatus(adapter.id, "idle")
          registered.push(adapter.id)
          console.log(`  ✅ ${adapter.name} (${result.version})`)
        } catch (err) {
          console.log(`  ⚠️ ${adapter.name} detected but failed to initialize: ${err}`)
          this.setStatus(adapter.id, "error")
        }
      } else {
        console.log(`  ⏭️ ${adapter.name} (not installed)`)
        this.setStatus(adapter.id, "offline")
      }
    }
    return registered
  }

  get(id: string): AgentAdapter | undefined {
    return this.adapters.get(id)
  }

  getStatus(id: string): AgentStatus {
    return this.statuses.get(id) ?? "offline"
  }

  getAllStatuses(): Map<string, AgentStatus> {
    return new Map(this.statuses)
  }

  resolveAdapterForRole(roleId: string): { adapter: AgentAdapter; adapterId: string } | null {
    const role = this.roles.get(roleId)
    if (!role) return null

    // Try preferred first
    const preferred = this.adapters.get(role.preferred)
    if (preferred && this.statuses.get(role.preferred) !== "error") {
      return { adapter: preferred, adapterId: role.preferred }
    }

    // Try fallbacks
    for (const fallbackId of role.fallback) {
      const fallback = this.adapters.get(fallbackId)
      if (fallback && this.statuses.get(fallbackId) !== "error") {
        return { adapter: fallback, adapterId: fallbackId }
      }
    }

    return null
  }

  getAdapterForAgent(agentId: string): AgentAdapter | null {
    const role = this.roles.get(agentId)
    const chain = role ? [role.preferred, ...role.fallback] : [agentId]
    for (const adapterId of chain) {
      const adapter = this.adapters.get(adapterId)
      if (adapter) return adapter
    }
    return null
  }

  async executeWithFallback(
    agentId: string,
    task: AgentTask,
  ): Promise<AgentResponse & { adapterId: string }> {
    const role = this.roles.get(agentId)
    const chain = role ? [role.preferred, ...role.fallback] : [agentId]

    let lastError: Error | null = null
    for (const adapterId of chain) {
      const adapter = this.adapters.get(adapterId)
      if (!adapter) continue

      this.setStatus(agentId, "busy")
      try {
        const health = await adapter.healthCheck()
        if (!health.healthy) {
          this.setStatus(adapterId, "error")
          continue
        }

        const result = await withTimeout(adapter.run(task), task.timeout ?? 300_000)
        this.setStatus(agentId, "idle")
        return { ...result, adapterId, sessionId: result.sessionId }
      } catch (err) {
        lastError = err as Error
        this.setStatus(agentId, "error")
        continue
      }
    }

    this.setStatus(agentId, "error")
    throw new Error(`All adapters failed for ${agentId}: ${lastError?.message}`)
  }

  async shutdown(): Promise<void> {
    const promises = Array.from(this.adapters.values()).map(a =>
      a.shutdown().catch(() => {})
    )
    await Promise.all(promises)
    this.adapters.clear()
  }

  getAvailableAdapters(): Array<{ id: string; name: string; capabilities: string[]; status: AgentStatus }> {
    return Array.from(this.adapters.entries()).map(([id, adapter]) => ({
      id,
      name: adapter.name,
      capabilities: adapter.capabilities,
      status: this.statuses.get(id) ?? "offline",
    }))
  }

  getRoles(): Array<{ id: string } & RoleConfig & { adapterId: string | null; status: AgentStatus }> {
    return Array.from(this.roles.entries()).map(([id, config]) => {
      const resolved = this.resolveAdapterForRole(id)
      return {
        id,
        ...config,
        adapterId: resolved?.adapterId ?? null,
        status: this.getStatus(id),
      }
    })
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
    promise.then(
      (result) => { clearTimeout(timer); resolve(result) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}
