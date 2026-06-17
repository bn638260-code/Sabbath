/**
 * Downloads the Whisper tiny English ggml model used by CI and release builds.
 *
 * Run: bun run download:whisper
 */

import { existsSync } from "node:fs"
import { mkdir, rename, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const MODEL_URL =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin"
const MODEL_DIR = join(__dirname, "..", "models", "whisper")
const MODEL_PATH = join(MODEL_DIR, "ggml-tiny.en.bin")
const TEMP_MODEL_PATH = `${MODEL_PATH}.tmp`
const EXPECTED_SIZE_BYTES = 77_704_715

function formatMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function existingModelIsValid() {
  if (!existsSync(MODEL_PATH)) return false

  const file = await import("node:fs/promises").then((fs) =>
    fs.stat(MODEL_PATH)
  )
  return file.size === EXPECTED_SIZE_BYTES
}

async function downloadModel() {
  await mkdir(MODEL_DIR, { recursive: true })
  await rm(TEMP_MODEL_PATH, { force: true })

  const response = await fetch(MODEL_URL, { redirect: "follow" })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while downloading ${MODEL_URL}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength !== EXPECTED_SIZE_BYTES) {
    throw new Error(
      `Downloaded Whisper model has unexpected size ${formatMB(
        buffer.byteLength
      )}; expected ${formatMB(EXPECTED_SIZE_BYTES)}`
    )
  }

  await writeFile(TEMP_MODEL_PATH, buffer)
  await rename(TEMP_MODEL_PATH, MODEL_PATH)
}

async function main() {
  console.log("\n=== Downloading Whisper tiny English model ===\n")

  if (await existingModelIsValid()) {
    console.log(
      `  Whisper model already present: ${MODEL_PATH} (${formatMB(
        EXPECTED_SIZE_BYTES
      )})`
    )
    return
  }

  console.log(`  Downloading ${MODEL_URL}`)
  await downloadModel()
  console.log(`  Saved ${MODEL_PATH} (${formatMB(EXPECTED_SIZE_BYTES)})`)
}

main().catch(async (error) => {
  await rm(TEMP_MODEL_PATH, { force: true })
  console.error("Download failed:", error)
  process.exit(1)
})
