import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const tauriRoot = path.join(repoRoot, "src-tauri")
const tauriConfigPath = path.join(tauriRoot, "tauri.conf.json")

type TauriConfig = {
  bundle?: {
    resources?: Record<string, string>
  }
}

function readTauriResources() {
  const config = JSON.parse(
    readFileSync(tauriConfigPath, "utf8")
  ) as TauriConfig

  return config.bundle?.resources ?? {}
}

function isGitIgnored(relativePath: string) {
  try {
    execFileSync("git", ["check-ignore", "-q", "--", relativePath], {
      cwd: repoRoot,
      stdio: "ignore",
    })
    return true
  } catch {
    return false
  }
}

describe("Tauri generated resource contracts", () => {
  it("does not bundle removed Sherpa resources", () => {
    const resources = readTauriResources()

    expect(Object.keys(resources).some((key) => key.includes("sherpa"))).toBe(
      false
    )
    expect(
      Object.values(resources).some((value) => value.includes("sherpa"))
    ).toBe(false)
  })

  it("continues treating downloaded model payloads as untracked assets", () => {
    expect(
      isGitIgnored("models/vosk/vosk-model-en-us-0.22-lgraph/am/final.mdl")
    ).toBe(true)
    expect(isGitIgnored("sidecars/vosk_worker.exe")).toBe(true)
  })
})
