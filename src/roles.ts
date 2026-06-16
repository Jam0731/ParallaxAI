import { Router, Request, Response } from "express"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import { join } from "path"
import { Store } from "./store.js"
import { AdapterRegistry } from "./adapters/registry.js"

export function createRoleRouter(store: Store, registry: AdapterRegistry, projectDir: string): Router {
  const router = Router()
  const agentConfigsDir = join(projectDir, "agent-configs")

  function getParam(req: Request, name: string): string {
    const val = req.params[name]
    return Array.isArray(val) ? val[0] : val
  }

  // GET /api/roles — list all roles
  router.get("/", (_req: Request, res: Response) => {
    const roles = store.listRoles()
    const enriched = roles.map(role => {
      const agentsMdPath = join(role.configDir, "AGENTS.md")
      const skillMdPath = join(role.configDir, "SKILL.md")
      return {
        ...role,
        hasAgentsMd: existsSync(agentsMdPath),
        hasSkillMd: existsSync(skillMdPath),
        agentStatus: registry.getStatus(role.id),
      }
    })
    res.json(enriched)
  })

  // POST /api/roles — create new role
  router.post("/", (req: Request, res: Response) => {
    const { id, name, adapter, fallback } = req.body
    if (!id || !name || !adapter) {
      res.status(400).json({ error: "id, name, adapter are required" })
      return
    }

    const configDir = join(agentConfigsDir, id)
    mkdirSync(configDir, { recursive: true })

    store.createRole(id, name, adapter, fallback ?? [], configDir)

    // Create default AGENTS.md if it doesn't exist
    const agentsMdPath = join(configDir, "AGENTS.md")
    if (!existsSync(agentsMdPath)) {
      writeFileSync(agentsMdPath, `# ${name}\n\nYou are ${name}.\n`)
    }

    res.json({ id, name, adapter, fallback: fallback ?? [], configDir })
  })

  // PUT /api/roles/:id — update role config
  router.put("/:id", (req: Request, res: Response) => {
    const id = getParam(req, "id")
    const existing = store.getRole(id)
    if (!existing) {
      res.status(404).json({ error: "Role not found" })
      return
    }

    const { name, adapter, fallback } = req.body
    store.updateRole(id, { name, adapter, fallback })

    res.json({ ...existing, name: name ?? existing.name, adapter: adapter ?? existing.adapter })
  })

  // DELETE /api/roles/:id — delete role
  router.delete("/:id", (req: Request, res: Response) => {
    const id = getParam(req, "id")
    store.deleteRole(id)
    res.json({ deleted: id })
  })

  // GET /api/roles/:id/prompt — get AGENTS.md content
  router.get("/:id/prompt", (req: Request, res: Response) => {
    const id = getParam(req, "id")
    const role = store.getRole(id)
    if (!role) {
      res.status(404).json({ error: "Role not found" })
      return
    }

    const agentsMdPath = join(role.configDir, "AGENTS.md")
    if (!existsSync(agentsMdPath)) {
      res.json({ content: "" })
      return
    }

    const content = readFileSync(agentsMdPath, "utf-8")
    res.json({ content })
  })

  // PUT /api/roles/:id/prompt — update AGENTS.md content
  router.put("/:id/prompt", (req: Request, res: Response) => {
    const id = getParam(req, "id")
    const { content } = req.body
    const role = store.getRole(id)
    if (!role) {
      res.status(404).json({ error: "Role not found" })
      return
    }

    const agentsMdPath = join(role.configDir, "AGENTS.md")
    writeFileSync(agentsMdPath, content)
    res.json({ saved: true, path: agentsMdPath })
  })

  // GET /api/roles/:id/skill — get SKILL.md content
  router.get("/:id/skill", (req: Request, res: Response) => {
    const id = getParam(req, "id")
    const role = store.getRole(id)
    if (!role) {
      res.status(404).json({ error: "Role not found" })
      return
    }

    const skillMdPath = join(role.configDir, "SKILL.md")
    if (!existsSync(skillMdPath)) {
      res.json({ content: "" })
      return
    }

    const content = readFileSync(skillMdPath, "utf-8")
    res.json({ content })
  })

  // PUT /api/roles/:id/skill — update SKILL.md content
  router.put("/:id/skill", (req: Request, res: Response) => {
    const id = getParam(req, "id")
    const { content } = req.body
    const role = store.getRole(id)
    if (!role) {
      res.status(404).json({ error: "Role not found" })
      return
    }

    const skillMdPath = join(role.configDir, "SKILL.md")
    writeFileSync(skillMdPath, content)
    res.json({ saved: true, path: skillMdPath })
  })

  // POST /api/roles/:id/test — test role with a message
  router.post("/:id/test", async (req: Request, res: Response) => {
    const id = getParam(req, "id")
    const { message } = req.body
    const role = store.getRole(id)
    if (!role) {
      res.status(404).json({ error: "Role not found" })
      return
    }

    try {
      const adapter = registry.getAdapterForAgent(id)
      if (!adapter) {
        res.status(400).json({ error: "No adapter available for this role" })
        return
      }

      const result = await adapter.run({
        message,
        agentId: id,
        workDir: process.cwd(),
        timeout: 60_000,
      })

      res.json({ response: result.text, usage: result.usage })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  return router
}
