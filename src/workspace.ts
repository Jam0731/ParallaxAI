import { join } from "path"
import { existsSync, mkdirSync } from "fs"
import { createHash } from "crypto"
import { Store } from "./store.js"

export interface Workspace {
  id: string
  name: string
  path: string
  isDefault: boolean
}

export class WorkspaceManager {
  private activeWorkspaceId?: string

  constructor(
    private store: Store,
    private dataDir: string,
  ) {}

  initialize(defaultPath?: string): Workspace {
    // Try to get the most recently used workspace
    const recent = this.store.getMostRecentWorkspace()
    if (recent) {
      this.activeWorkspaceId = recent.id
      this.store.updateWorkspaceLastActive(recent.id)
      return recent
    }

    // No workspaces exist — create default
    const path = defaultPath ?? process.cwd()
    const name = path.split("/").pop() ?? "default"
    const id = `ws-${this.hashPath(path)}`

    this.store.createWorkspace(id, name, path, true)
    this.activeWorkspaceId = id

    // Create workspace directory
    const wsDir = join(this.dataDir, "workspaces", id)
    mkdirSync(wsDir, { recursive: true })

    return { id, name, path, isDefault: true }
  }

  getActive(): Workspace | undefined {
    if (!this.activeWorkspaceId) return undefined
    return this.store.getWorkspace(this.activeWorkspaceId)
  }

  getActiveId(): string | undefined {
    return this.activeWorkspaceId
  }

  list(): Workspace[] {
    return this.store.listWorkspaces()
  }

  switchTo(workspaceId: string): Workspace | undefined {
    const ws = this.store.getWorkspace(workspaceId)
    if (!ws) return undefined
    this.activeWorkspaceId = workspaceId
    this.store.updateWorkspaceLastActive(workspaceId)
    return ws
  }

  create(path: string, name?: string): Workspace {
    // Check if already exists
    const existing = this.store.getWorkspaceByPath(path)
    if (existing) {
      this.activeWorkspaceId = existing.id
      this.store.updateWorkspaceLastActive(existing.id)
      return existing
    }

    const wsName = name ?? path.split("/").pop() ?? "unnamed"
    const id = `ws-${this.hashPath(path)}`

    this.store.createWorkspace(id, wsName, path, false)
    this.activeWorkspaceId = id

    // Create workspace directory
    const wsDir = join(this.dataDir, "workspaces", id)
    mkdirSync(wsDir, { recursive: true })

    return { id, name: wsName, path, isDefault: false }
  }

  private hashPath(path: string): string {
    return createHash("md5").update(path).digest("hex").slice(0, 12)
  }
}
