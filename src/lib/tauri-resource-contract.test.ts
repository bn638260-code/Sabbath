import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
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

const generatedResourceContracts = [
  {
    source: "../models/sherpa/sherpa-onnx-streaming-zipformer-en-2023-06-26",
    destination:
      "models/sherpa/sherpa-onnx-streaming-zipformer-en-2023-06-26",
    marker: "models/sherpa/sherpa-onnx-streaming-zipformer-en-2023-06-26/.gitkeep",
    ignoredPayload:
      "models/sherpa/sherpa-onnx-streaming-zipformer-en-2023-06-26/tokens.txt",
  },
  {
    source: "../sidecars/sherpa_worker",
    destination: "scripts/sherpa_worker",
    marker: "sidecars/sherpa_worker/.gitkeep",
    ignoredPayload: "sidecars/sherpa_worker/sherpa_worker.exe",
  },
] as const

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
  it("keeps generated Sherpa resource directories present in clean checkouts", () => {
    const resources = readTauriResources()

    for (const contract of generatedResourceContracts) {
      expect(resources[contract.source]).toBe(contract.destination)
      expect(existsSync(path.resolve(tauriRoot, contract.source))).toBe(true)
      expect(existsSync(path.join(repoRoot, contract.marker))).toBe(true)
    }
  })

  it("tracks only directory markers for generated Sherpa resources", () => {
    for (const contract of generatedResourceContracts) {
      expect(isGitIgnored(contract.marker)).toBe(false)
      expect(isGitIgnored(contract.ignoredPayload)).toBe(true)
    }
  })
})
