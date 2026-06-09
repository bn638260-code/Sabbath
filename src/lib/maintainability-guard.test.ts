import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = join(import.meta.dirname, "../..")
const SRC_ROOT = join(REPO_ROOT, "src")

const FILE_LINE_CEILINGS: Record<string, number> = {
  "src/components/service-plan/ServicePlanPage.tsx": 250,
  "src/components/settings-dialog.tsx": 250,
  "src/components/broadcast/broadcast-settings.tsx": 350,
  "src/components/panels/search-panel.tsx": 350,
}

const STT_RS_CEILING = 750
const STT_RS_PATH = "src-tauri/src/commands/stt/mod.rs"

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "test-results",
  "playwright-report",
])

function lineCount(relativePath: string): number {
  const content = readFileSync(join(REPO_ROOT, relativePath), "utf8")
  if (content.length === 0) return 0
  return content.split(/\r?\n/).length
}

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      files.push(...listSourceFiles(fullPath))
      continue
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      files.push(relative(REPO_ROOT, fullPath).replace(/\\/g, "/"))
    }
  }
  return files
}

describe("maintainability guard — file size ceilings", () => {
  it("keeps reviewed frontend shells within plan limits", () => {
    for (const [path, ceiling] of Object.entries(FILE_LINE_CEILINGS)) {
      expect(lineCount(path), `${path} exceeds ${ceiling} lines`).toBeLessThanOrEqual(
        ceiling,
      )
    }
  })

  it("keeps stt.rs orchestration within plan limit", () => {
    expect(lineCount(STT_RS_PATH)).toBeLessThanOrEqual(STT_RS_CEILING)
  })
})

describe("maintainability guard — single IPC wrapper", () => {
  it("imports @tauri-apps/api/core only from tauri-runtime.ts", () => {
    const violations: string[] = []
    for (const file of listSourceFiles(SRC_ROOT)) {
      if (file === "src/lib/tauri-runtime.ts") continue
      const content = readFileSync(join(REPO_ROOT, file), "utf8")
      if (/from ["']@tauri-apps\/api\/core["']/.test(content)) {
        violations.push(file)
      }
    }
    expect(violations).toEqual([])
  })
})

describe("maintainability guard — empty catch handlers", () => {
  it("does not add swallowed empty catches", () => {
    const violations: string[] = []
    for (const file of listSourceFiles(SRC_ROOT)) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8")
      if (/\.catch\(\(\) => \{\}\)/.test(content)) {
        violations.push(file)
      }
    }
    expect(violations).toEqual([])
  })
})

describe("maintainability guard — extracted module presence", () => {
  const expectedFiles = [
    "src/services/slides/sermon-slide-live.ts",
    "src/lib/service-plan/active-item-content-label.ts",
    "src/hooks/use-broadcast-output-settings.ts",
    "src/hooks/use-audio-devices.ts",
    "src/hooks/use-context-verse-search.ts",
    "src-tauri/src/commands/stt/utils.rs",
    "src-tauri/src/commands/stt/detection.rs",
  ]

  it("keeps maintainability split artifacts on disk", () => {
    for (const path of expectedFiles) {
      expect(statSync(join(REPO_ROOT, path)).isFile()).toBe(true)
    }
  })
})
