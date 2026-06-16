import { createInterface } from "readline"
import type { ChildProcess } from "child_process"
import type { AcpInitializeResult, AcpNotification } from "../types.js"

export class AcpError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown,
  ) {
    super(message)
    this.name = "AcpError"
  }
}

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export class AcpConnection {
  private nextId = 0
  private pending = new Map<number, PendingRequest>()
  private notificationHandlers = new Map<string, Array<(params: unknown) => void>>()
  private closed = false
  public serverInfo?: AcpInitializeResult

  constructor(
    private stdin: NodeJS.WritableStream,
    stdout: NodeJS.ReadableStream,
  ) {
    const rl = createInterface({ input: stdout })
    rl.on("line", (line) => {
      if (this.closed) return
      try {
        const msg = JSON.parse(line)
        this.handleMessage(msg)
      } catch {
        // ignore malformed lines
      }
    })
    rl.on("close", () => this.close())
  }

  private handleMessage(msg: any): void {
    // Response to our request
    if (msg.id !== undefined && this.pending.has(msg.id)) {
      const pending = this.pending.get(msg.id)!
      this.pending.delete(msg.id)
      clearTimeout(pending.timeout)
      if (msg.error) {
        pending.reject(new AcpError(msg.error.code, msg.error.message, msg.error.data))
      } else {
        pending.resolve(msg.result)
      }
      return
    }

    // Notification from agent
    if (msg.method) {
      const handlers = this.notificationHandlers.get(msg.method) ?? []
      for (const handler of handlers) {
        try { handler(msg.params) } catch { /* ignore */ }
      }
    }
  }

  async request(method: string, params?: unknown, timeoutMs = 30_000): Promise<any> {
    if (this.closed) throw new AcpError(-1, "Connection closed")
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new AcpError(-2, `Request timeout: ${method}`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timeout })
      const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params })
      this.stdin.write(msg + "\n")
    })
  }

  notify(method: string, params?: unknown): void {
    if (this.closed) return
    const msg = JSON.stringify({ jsonrpc: "2.0", method, params })
    this.stdin.write(msg + "\n")
  }

  onNotification(method: string, handler: (params: unknown) => void): void {
    const handlers = this.notificationHandlers.get(method) ?? []
    handlers.push(handler)
    this.notificationHandlers.set(method, handlers)
  }

  offNotification(method: string, handler: (params: unknown) => void): void {
    const handlers = this.notificationHandlers.get(method) ?? []
    const idx = handlers.indexOf(handler)
    if (idx >= 0) handlers.splice(idx, 1)
  }

  async initialize(): Promise<AcpInitializeResult> {
    const result = await this.request("initialize", {
      protocolVersion: 1,
      clientInfo: { name: "parallax-ai", version: "0.1.0" },
    }) as AcpInitializeResult
    this.serverInfo = result
    this.notify("initialized", {})
    return result
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout)
      pending.reject(new AcpError(-1, "Connection closed"))
    }
    this.pending.clear()
  }

  get isClosed(): boolean {
    return this.closed
  }
}
