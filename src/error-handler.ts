import type { AgentAdapter, AgentTask, AgentResponse, AgentId } from "./types.js"
import type { AdapterRegistry } from "./adapters/registry.js"

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

export class ErrorHandler {
  private retryConfigs = new Map<string, RetryConfig>()
  private circuitBreakers = new Map<string, { failures: number; lastFailure: number; open: boolean }>()

  constructor(private registry: AdapterRegistry) {}

  setRetryConfig(agentId: string, config: Partial<RetryConfig>): void {
    this.retryConfigs.set(agentId, { ...DEFAULT_RETRY_CONFIG, ...config })
  }

  async executeWithRetry(
    agentId: AgentId,
    task: AgentTask,
  ): Promise<AgentResponse & { adapterId: string }> {
    const config = this.retryConfigs.get(agentId) ?? DEFAULT_RETRY_CONFIG
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      // Check circuit breaker
      if (this.isCircuitOpen(agentId)) {
        throw new Error(`Circuit breaker open for ${agentId}. Too many consecutive failures.`)
      }

      try {
        const result = await this.registry.executeWithFallback(agentId, task)
        this.recordSuccess(agentId)
        return result
      } catch (err) {
        lastError = err as Error
        this.recordFailure(agentId)

        // Don't retry on non-recoverable errors
        if (this.isNonRecoverable(lastError)) {
          throw lastError
        }

        // Wait before retry with exponential backoff
        if (attempt < config.maxRetries) {
          const delay = Math.min(
            config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
            config.maxDelayMs,
          )
          await new Promise(r => setTimeout(r, delay))
        }
      }
    }

    throw new Error(`All ${config.maxRetries + 1} attempts failed for ${agentId}: ${lastError?.message}`)
  }

  private isCircuitOpen(agentId: string): boolean {
    const cb = this.circuitBreakers.get(agentId)
    if (!cb || !cb.open) return false
    // Reset after 60 seconds
    if (Date.now() - cb.lastFailure > 60_000) {
      cb.open = false
      cb.failures = 0
      return false
    }
    return true
  }

  private recordFailure(agentId: string): void {
    const cb = this.circuitBreakers.get(agentId) ?? { failures: 0, lastFailure: 0, open: false }
    cb.failures++
    cb.lastFailure = Date.now()
    if (cb.failures >= 5) cb.open = true
    this.circuitBreakers.set(agentId, cb)
  }

  private recordSuccess(agentId: string): void {
    this.circuitBreakers.delete(agentId)
  }

  private isNonRecoverable(err: Error): boolean {
    const msg = err.message.toLowerCase()
    return msg.includes("not found") || msg.includes("not installed") || msg.includes("permission denied")
  }

  getCircuitBreakerStatus(): Array<{ agentId: string; failures: number; isOpen: boolean }> {
    return Array.from(this.circuitBreakers.entries()).map(([id, cb]) => ({
      agentId: id,
      failures: cb.failures,
      isOpen: cb.open,
    }))
  }
}
