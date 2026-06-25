/**
 * Downloads the pre-exported gte-small ONNX embedding model (int8) and its
 * tokenizer from Hugging Face into models/gte-small/.
 *
 * Unlike the MiniLM script, gte-small ships a ready-made ONNX export, so no
 * Python / optimum conversion is needed — just two file downloads.
 *
 * After this, run `bun run precompute:embeddings` to (re)generate the
 * gte-small verse index that the app loads.
 *
 * Run: bun run download:gte-small
 */

import { mkdir } from "node:fs/promises"
import { dirname, join } from "node:path"
import { PROJECT_ROOT } from "./lib/python-env"

const HF_BASE = "https://huggingface.co/Xenova/gte-small/resolve/main"
const MODEL_DIR = join(PROJECT_ROOT, "models", "gte-small")

const FILES: { url: string; dest: string; minBytes: number }[] = [
  {
    url: `${HF_BASE}/onnx/model_quantized.onnx`,
    dest: join(MODEL_DIR, "onnx", "model_quantized.onnx"),
    minBytes: 10_000_000, // ~33 MB expected; guard against an HTML error page
  },
  {
    url: `${HF_BASE}/tokenizer.json`,
    dest: join(MODEL_DIR, "tokenizer.json"),
    minBytes: 100_000, // ~700 KB expected
  },
]

async function download(url: string, dest: string, minBytes: number) {
  await mkdir(dirname(dest), { recursive: true })
  console.log(`  Downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  const bytes = await res.arrayBuffer()
  if (bytes.byteLength < minBytes) {
    throw new Error(
      `Downloaded ${dest} is only ${bytes.byteLength} bytes (expected >= ${minBytes}); the URL may have returned an error page.`
    )
  }
  await Bun.write(dest, bytes)
  console.log(`  Saved ${dest} (${bytes.byteLength} bytes)`)
}

async function main() {
  console.log("\nDownloading gte-small ONNX model + tokenizer from Hugging Face...\n")
  for (const file of FILES) {
    await download(file.url, file.dest, file.minBytes)
  }
  console.log(`\nModel ready in ${MODEL_DIR}`)
  console.log("Next: bun run precompute:embeddings  (regenerates the gte-small verse index)\n")
}

main().catch((err) => {
  console.error("Failed:", err)
  process.exit(1)
})
