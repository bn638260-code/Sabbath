/**
 * Unified pipeline: sets up everything needed for SabbathCue from scratch.
 *
 * Phase 1: Python environment (.venv + all pip deps)
 * Phase 2: Download Bible data (pre-built zip + cross-refs)
 * Phase 3: Build rhema.db (SQLite + FTS5)
 * Phase 4: Import EGW books into rhema.db
 * Phase 5: Download and export ONNX model + INT8 quantization
 * Phase 6: Export canonical KJV/NKJV/NLT verses to JSON
 * Phase 7: Pre-compute verse embeddings
 * Phase 8: Download Vosk model for local STT
 *
 * Every phase is idempotent: if its output artifacts already exist it is
 * skipped. Pass --force to re-run everything regardless.
 *
 * Run: bun run setup:all
 *      bun run setup:all --force
 */

import { existsSync } from "node:fs"
import { join } from "node:path"
import { ensurePythonEnv, getVenvBin, PROJECT_ROOT } from "./lib/python-env"

const DATA_DIR = join(PROJECT_ROOT, "data")
const MODELS_DIR = join(PROJECT_ROOT, "models", "minilm-l6-v2")
const MODELS_DIR_INT8 = join(PROJECT_ROOT, "models", "minilm-l6-v2-int8")

const KJV_SOURCE = join(DATA_DIR, "sources", "KJV.json")
const NIV_SOURCE = join(DATA_DIR, "sources", "NIV.json")
const ESV_SOURCE = join(DATA_DIR, "sources", "ESV.json")
const CROSS_REFS = join(DATA_DIR, "cross-refs", "cross_references.txt")
const DB_PATH = join(DATA_DIR, "rhema.db")
const EGW_SOURCE_DIR = join(DATA_DIR, "sources", "egw")
const VERSES_JSON = join(DATA_DIR, "verses-for-embedding.json")
const EMB_BIN = join(
  PROJECT_ROOT,
  "embeddings",
  "public-minilm-l6-v2.bin"
)
const IDS_BIN = join(
  PROJECT_ROOT,
  "embeddings",
  "public-minilm-l6-v2-ids.bin"
)
const VOSK_MODEL_CONF = join(
  PROJECT_ROOT,
  "models",
  "vosk",
  "vosk-model-en-us-0.22-lgraph",
  "conf",
  "model.conf"
)
const MODEL_ONNX = join(MODELS_DIR, "onnx", "model.onnx")
const MODEL_INT8 = join(MODELS_DIR_INT8, "onnx", "model_quantized.onnx")
const TOKENIZER = join(MODELS_DIR, "tokenizer.json")

const force = process.argv.includes("--force")

function shouldSkip(label: string, ...artifacts: string[]): boolean {
  if (force) return false

  const allExist = artifacts.every((path) => existsSync(path))
  if (allExist) {
    console.log(`  Skip: ${label} (artifacts already exist)`)
  }
  return allExist
}

async function run(
  cmd: string[],
  cwd?: string,
  extraEnv?: Record<string, string>
): Promise<void> {
  const proc = Bun.spawn(cmd, {
    stdout: "inherit",
    stderr: "inherit",
    cwd: cwd ?? PROJECT_ROOT,
    env: { ...process.env, ...extraEnv },
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`Command failed (exit ${exitCode}): ${cmd.join(" ")}`)
  }
}

async function main() {
  console.log("\n==============================================")
  console.log("  SabbathCue Full Setup Pipeline")
  console.log("==============================================")
  if (force) console.log("  (--force: re-running all phases)\n")

  console.log("\n--- Phase 1/8: Python environment ---")
  await ensurePythonEnv([
    "optimum-onnx[onnxruntime]",
    "sentence-transformers",
    "accelerate",
    "tokenizers",
    "numpy",
    "torch",
    "meaningless",
  ])

  console.log("\n--- Phase 2/8: Download Bible source data ---")
  if (
    !shouldSkip(
      "Bible source data",
      KJV_SOURCE,
      NIV_SOURCE,
      ESV_SOURCE,
      CROSS_REFS
    )
  ) {
    await run(["bun", "run", join(DATA_DIR, "download-sources.ts")])
  }

  console.log("\n--- Phase 3/8: Build Bible database ---")
  if (!shouldSkip("Bible database", DB_PATH)) {
    await run(["bun", "run", join(DATA_DIR, "build-bible-db.ts")])
  }

  console.log("\n--- Phase 4/8: Import EGW books ---")
  if (existsSync(DB_PATH) && existsSync(EGW_SOURCE_DIR)) {
    await run(["bun", "run", join(DATA_DIR, "build-egw.ts")])
  } else {
    console.log("  Skip: EGW import (database or source files missing)")
  }

  console.log("\n--- Phase 5/8: ONNX model download and quantize ---")
  if (!shouldSkip("ONNX models", MODEL_ONNX, MODEL_INT8, TOKENIZER)) {
    const venvPython = getVenvBin(
      process.platform === "win32" ? "python" : "python3"
    )
    await run(
      [venvPython, join(DATA_DIR, "export-minilm-onnx.py")],
      undefined,
      { PYTHONUTF8: "1" }
    )
  }

  console.log("\n--- Phase 6/8: Export verses to JSON ---")
  if (!shouldSkip("verses JSON", VERSES_JSON)) {
    if (!existsSync(DB_PATH)) {
      console.error("  rhema.db not found. Run phases 2-4 first.")
      process.exit(1)
    }
    await run(["bun", "run", join(DATA_DIR, "compute-embeddings.ts")])
  }

  console.log("\n--- Phase 7/8: Pre-compute verse embeddings ---")
  if (!shouldSkip("precomputed embeddings", EMB_BIN, IDS_BIN)) {
    const venvPython = getVenvBin(
      process.platform === "win32" ? "python" : "python3"
    )
    await run(
      [venvPython, join(DATA_DIR, "precompute-embeddings.py")],
      undefined,
      { PYTHONUTF8: "1" }
    )
  }

  console.log("\n--- Phase 8/8: Download Vosk model ---")
  if (!shouldSkip("Vosk model", VOSK_MODEL_CONF)) {
    await run(["bun", "run", "download:vosk"])
  }

  console.log("\n==============================================")
  console.log("  Setup complete")
  console.log("==============================================\n")
}

main().catch((err) => {
  console.error("\nPipeline failed:", err.message ?? err)
  process.exit(1)
})
