import { join } from "path"
import { homedir } from "os"
import { existsSync, readFileSync } from "fs"
import express from "express"
import { Store } from "./store.js"
import { AdapterRegistry, type RoleConfig } from "./adapters/registry.js"
import { ContextManager } from "./context.js"
import { Gateway } from "./gateway.js"
import { CronScheduler } from "./cron/scheduler.js"
import { AutoDream } from "./session/auto-dream.js"
import { KnowledgeIndexer } from "./knowledge/indexer.js"
import { createRoleRouter } from "./roles.js"

const PROJECT_DIR = join(homedir(), "workspace", "ParallaxAI")
const DATA_DIR = process.env.PARALLAX_DATA_DIR ?? join(homedir(), ".parallaxai")
const PORT = parseInt(process.env.PARALLAX_PORT ?? "46446")
const SHARED_MEMORY_DIR = join(PROJECT_DIR, "shared_memory")

async function main() {
  console.log("🚀 ParallaxAI Gateway starting...")
  console.log(`   Data dir: ${DATA_DIR}`)
  console.log(`   Port: ${PORT}`)

  // Load role config
  const configPath = join(PROJECT_DIR, "config", "agents.json")
  let roles: Record<string, RoleConfig> = {
    munger:  { name: "Munger",  skill: "skills/munger/SKILL.md",  preferred: "mimo",     fallback: ["claude", "reasonix"] },
    woz:     { name: "Woz",     skill: "skills/woz/SKILL.md",     preferred: "claude",   fallback: ["mimo", "reasonix"] },
    ogilvy:  { name: "Ogilvy",  skill: "skills/ogilvy/SKILL.md",  preferred: "mimo",     fallback: ["claude"] },
    taleb:   { name: "Taleb",   skill: "skills/taleb/SKILL.md",   preferred: "mimo",     fallback: ["claude", "reasonix"] },
  }
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"))
      if (config.roles) roles = config.roles
    } catch { /* use defaults */ }
  }

  // Initialize store
  console.log("\n📦 Initializing store...")
  const store = new Store(DATA_DIR)

  // Initialize context manager
  const context = new ContextManager(SHARED_MEMORY_DIR, DATA_DIR)

  // Initialize adapter registry
  console.log("\n🔍 Detecting agents...")
  const registry = new AdapterRegistry(roles)
  const registered = await registry.detectAndRegister()

  if (registered.length === 0) {
    console.log("\n⚠️  No agents detected! Install at least one of: claude, mimo, reasonix")
    console.log("   The gateway will start but won't be able to process messages.")
  }

  // Show available roles
  console.log("\n📋 Available roles:")
  for (const role of registry.getRoles()) {
    const status = role.adapterId ? `✅ ${role.adapterId}` : "❌ no adapter"
    console.log(`   ${role.id} → ${status}`)
  }

  // Initialize knowledge indexer
  console.log("\n📚 Indexing knowledge base...")
  const knowledgeIndexer = new KnowledgeIndexer(store)
  const knowledgeDir = join(PROJECT_DIR, "shared_memory")
  if (existsSync(knowledgeDir)) {
    const indexed = knowledgeIndexer.indexDirectory(knowledgeDir)
    const stats = knowledgeIndexer.getStats()
    console.log(`   Indexed ${indexed} files, ${stats.chunks} chunks`)
  }

  // Initialize cron scheduler
  console.log("\n⏰ Starting cron scheduler...")
  const cronScheduler = new CronScheduler(store)
  cronScheduler.registerHandler("agent_turn", async (job) => {
    // Execute cron jobs through the gateway
    return `Job ${job.name} executed`
  })
  cronScheduler.start()

  // Initialize auto-dream
  const autoDream = new AutoDream(store, DATA_DIR)
  const activeWsId = store.getMostRecentWorkspace()?.id
  if (autoDream.shouldRun(activeWsId)) {
    console.log("\n💤 Auto-Dream: running memory consolidation...")
    const result = await autoDream.run(activeWsId)
    console.log(`   Added: ${result.entriesAdded}, Merged: ${result.entriesMerged}, Pruned: ${result.entriesPruned}`)
  }

  // Start HTTP API server
  const API_PORT = parseInt(process.env.PARALLAX_API_PORT ?? "46447")

  // Seed default roles into database
  const defaultRoles = [
    { id: "munger", name: "Munger", adapter: "mimo", fallback: ["claude"] },
    { id: "woz", name: "Woz", adapter: "claude", fallback: ["mimo"] },
    { id: "ogilvy", name: "Ogilvy", adapter: "mimo", fallback: ["claude"] },
    { id: "taleb", name: "Taleb", adapter: "mimo", fallback: ["claude"] },
  ]
  for (const role of defaultRoles) {
    if (!store.getRole(role.id)) {
      store.createRole(role.id, role.name, role.adapter, role.fallback, join(PROJECT_DIR, "agent-configs", role.id))
    }
  }

  const app = express()
  app.use(express.json())
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    res.header("Access-Control-Allow-Headers", "Content-Type")
    if (req.method === "OPTIONS") { res.sendStatus(200); return }
    next()
  })
  app.use("/api/roles", createRoleRouter(store, registry, PROJECT_DIR))
  
  app.get("/api/knowledge/search", (req, res) => {
    const query = req.query.q as string
    const limit = parseInt(req.query.limit as string) || 5
    if (!query) {
      res.status(400).json({ error: "Missing query parameter 'q'" })
      return
    }
    const results = knowledgeIndexer.query({ query, limit })
    res.json(results)
  })

  app.get("/api/knowledge/stats", (_req, res) => {
    res.json(knowledgeIndexer.getStats())
  })

  // Cron REST API
  app.get("/api/cron/jobs", (_req, res) => {
    res.json(store.listCronJobs())
  })

  app.post("/api/cron/jobs", (req, res) => {
    try {
      const jobId = store.addCronJob(req.body)
      res.json({ id: jobId, success: true })
    } catch (err) {
      res.status(400).json({ error: String(err) })
    }
  })

  app.delete("/api/cron/jobs/:id", (req, res) => {
    store.removeCronJob(req.params.id)
    res.json({ success: true })
  })

  app.get("/api/cron/runs", (req, res) => {
    const runs = store.listCronRuns(req.query.jobId as string, parseInt(req.query.limit as string) || 20)
    res.json(runs)
  })
  
  app.listen(API_PORT, () => {
    console.log(`\n🔌 API server on port ${API_PORT}`)
    console.log(`   Roles API: http://localhost:${API_PORT}/api/roles`)
  })

  // Start gateway
  console.log(`\n🌐 Starting gateway on port ${PORT}...`)
  const gateway = new Gateway(PORT, store, registry, context, DATA_DIR)
  console.log(`   WebSocket: ws://localhost:${PORT}`)
  console.log(`\n✅ ParallaxAI Gateway is ready!`)

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n🛑 Shutting down...")
    cronScheduler.stop()
    await gateway.close()
    await registry.shutdown()
    store.close()
    process.exit(0)
  }
  process.on("SIGTERM", shutdown)
  process.on("SIGINT", shutdown)
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
