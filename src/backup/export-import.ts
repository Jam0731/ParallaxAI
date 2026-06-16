import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from "fs"
import { join, relative } from "path"
import { createGzip, createGunzip } from "zlib"
import { pipeline } from "stream/promises"
import type { Store } from "../store.js"

export interface BackupManifest {
  version: string
  createdAt: string
  contents: {
    database: boolean
    memory: boolean
    skills: boolean
    sharedMemory: boolean
    config: boolean
  }
}

export class BackupManager {
  constructor(
    private store: Store,
    private projectDir: string,
    private dataDir: string,
  ) {}

  async exportBackup(outputPath: string): Promise<void> {
    const manifest: BackupManifest = {
      version: "0.1.0",
      createdAt: new Date().toISOString(),
      contents: {
        database: true,
        memory: true,
        skills: true,
        sharedMemory: true,
        config: true,
      },
    }

    // Create a simple tar-like archive using gzip
    // For MVP, we'll export as a directory that can be zipped
    const backupDir = join(this.dataDir, "backups", `backup-${Date.now()}`)
    mkdirSync(backupDir, { recursive: true })

    // Write manifest
    const { writeFileSync } = await import("fs")
    writeFileSync(join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2))

    // Copy database
    const dbPath = join(this.dataDir, "parallax.db")
    if (existsSync(dbPath)) {
      await this.copyFile(dbPath, join(backupDir, "parallax.db"))
    }

    // Copy skills
    const skillsDir = join(this.projectDir, "skills")
    if (existsSync(skillsDir)) {
      await this.copyDir(skillsDir, join(backupDir, "skills"))
    }

    // Copy shared memory
    const sharedDir = join(this.projectDir, "shared_memory")
    if (existsSync(sharedDir)) {
      await this.copyDir(sharedDir, join(backupDir, "shared_memory"))
    }

    // Copy config
    const configDir = join(this.projectDir, "config")
    if (existsSync(configDir)) {
      await this.copyDir(configDir, join(backupDir, "config"))
    }

    // Gzip the backup directory
    await this.gzipDir(backupDir, outputPath)
  }

  async importBackup(backupPath: string, strategy: "overwrite" | "merge" = "overwrite"): Promise<void> {
    if (!existsSync(backupPath)) throw new Error(`Backup not found: ${backupPath}`)

    // For MVP, we'll import from a directory
    const backupDir = backupPath.replace(/\.tar\.gz$/, "")

    // Read manifest
    const { readFileSync } = await import("fs")
    const manifestPath = join(backupDir, "manifest.json")
    if (!existsSync(manifestPath)) throw new Error("Invalid backup: missing manifest.json")

    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as BackupManifest

    if (strategy === "overwrite") {
      // Copy database
      if (manifest.contents.database) {
        const srcDb = join(backupDir, "parallax.db")
        if (existsSync(srcDb)) {
          await this.copyFile(srcDb, join(this.dataDir, "parallax.db"))
        }
      }

      // Copy skills
      if (manifest.contents.skills) {
        const srcSkills = join(backupDir, "skills")
        if (existsSync(srcSkills)) {
          await this.copyDir(srcSkills, join(this.projectDir, "skills"))
        }
      }

      // Copy shared memory
      if (manifest.contents.sharedMemory) {
        const srcShared = join(backupDir, "shared_memory")
        if (existsSync(srcShared)) {
          await this.copyDir(srcShared, join(this.projectDir, "shared_memory"))
        }
      }
    }
  }

  private async copyFile(src: string, dest: string): Promise<void> {
    await pipeline(createReadStream(src), createWriteStream(dest))
  }

  private async copyDir(src: string, dest: string): Promise<void> {
    mkdirSync(dest, { recursive: true })
    for (const entry of readdirSync(src)) {
      const srcPath = join(src, entry)
      const destPath = join(dest, entry)
      if (statSync(srcPath).isDirectory()) {
        await this.copyDir(srcPath, destPath)
      } else {
        await this.copyFile(srcPath, destPath)
      }
    }
  }

  private async gzipDir(dir: string, output: string): Promise<void> {
    // Simple gzip of the directory contents
    // In production, use tar with gzip
    const { execSync } = await import("child_process")
    execSync(`tar -czf "${output}" -C "${dir}" .`)
  }
}
