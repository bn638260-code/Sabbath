/**
 * Downloads the paraphrase-multilingual-MiniLM-L12-v2 ONNX model for Bible semantic search.
 *
 * Run: bun run download:multilingual-model
 */

import { join } from "node:path"
import {
  ensurePythonEnv,
  getVenvBin,
  PROJECT_ROOT,
} from "./lib/python-env"

async function main() {
  await ensurePythonEnv([
    "optimum-onnx[onnxruntime]",
    "sentence-transformers",
    "accelerate",
  ])

  const python = getVenvBin(process.platform === "win32" ? "python" : "python3")

  console.log(
    "\nExporting paraphrase-multilingual-MiniLM-L12-v2 to ONNX...\n"
  )

  const proc = Bun.spawn(
    [python, join(PROJECT_ROOT, "data", "export-multilingual-minilm-onnx.py")],
    {
      stdout: "inherit",
      stderr: "inherit",
      env: { ...process.env, PYTHONUTF8: "1" },
    }
  )

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    console.error("\nMultilingual model export failed.")
    process.exit(1)
  }

  console.log("\nMultilingual model ready under models/multilingual-minilm-l12-v2*\n")
}

main().catch((err) => {
  console.error("Failed:", err)
  process.exit(1)
})
