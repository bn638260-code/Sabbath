/**
 * Downloads the Whisper tiny.en GGML model for local speech-to-text.
 *
 * Model: ggml-tiny.en.bin (~75MB)
 * Source: https://huggingface.co/ggerganov/whisper.cpp
 *
 * Run: bun run download:whisper
 */

import { dirname, join } from "node:path"
import { createHash } from "node:crypto"
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
} from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = join(MODULE_DIR, "..")
const MODELS_DIR = join(PROJECT_ROOT, "models", "whisper")
const MODEL_FILE = "ggml-tiny.en.bin"
const MODEL_PATH = join(MODELS_DIR, MODEL_FILE)
const MODEL_URL = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${MODEL_FILE}`
const TMP_MODEL_PATH = `${MODEL_PATH}.tmp`
const MAX_ATTEMPTS = 5
const EXPECTED_SHA256 =
  "921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f"

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type FetchWithRetryOptions = {
  headers?: Record<string, string>
  maxAttempts?: number
  sleep?: (ms: number) => Promise<unknown>
}

function getHeaders() {
  const token = process.env.HF_TOKEN ?? process.env.HUGGINGFACE_TOKEN
  if (!token) return undefined

  return {
    Authorization: `Bearer ${token}`,
  }
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256")
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("end", resolve)
    stream.on("error", reject)
  })
  return hash.digest("hex")
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
) {
  const headers = options.headers ?? getHeaders()
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS
  const sleepFn = options.sleep ?? sleep

  if (maxAttempts < 1) {
    throw new Error("maxAttempts must be at least 1")
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      headers,
      redirect: "follow",
    })

    if (response.ok) {
      return response
    }

    if (response.status !== 429 && response.status < 500) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }

    if (attempt === maxAttempts) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }

    const retryAfterHeader = response.headers.get("retry-after")
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1_000 : NaN
    const backoffMs = Number.isFinite(retryAfterMs)
      ? retryAfterMs
      : Math.min(30_000, 2_000 * 2 ** (attempt - 1))

    console.warn(
      `Download attempt ${attempt} failed with ${response.status}. Retrying in ${Math.round(backoffMs / 1_000)}s...`
    )
    await sleepFn(backoffMs)
  }

  throw new Error("Download failed after retries")
}

export async function main() {
  if (existsSync(MODEL_PATH)) {
    console.log(`Whisper model already exists: ${MODEL_PATH}`)
    return
  }

  mkdirSync(MODELS_DIR, { recursive: true })

  console.log(`Downloading Whisper model from ${MODEL_URL}`)
  console.log(`Destination: ${MODEL_PATH}`)
  if (getHeaders()) {
    console.log("Using Hugging Face token from environment.")
  }

  const response = await fetchWithRetry(MODEL_URL)

  const totalBytes = Number(response.headers.get("content-length") ?? 0)
  const totalMB = (totalBytes / 1_000_000).toFixed(0)
  console.log(`Size: ${totalMB} MB`)

  rmSync(TMP_MODEL_PATH, { force: true })

  const writer = createWriteStream(TMP_MODEL_PATH)
  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response body")

  let downloaded = 0
  let lastPercent = -1

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    writer.write(Buffer.from(value))
    downloaded += value.byteLength

    const percent = totalBytes > 0 ? Math.floor((downloaded / totalBytes) * 100) : 0
    if (percent !== lastPercent && percent % 5 === 0) {
      process.stdout.write(`\r  ${percent}% (${(downloaded / 1_000_000).toFixed(0)}/${totalMB} MB)`)
      lastPercent = percent
    }
  }

  writer.end()
  await new Promise<void>((resolve, reject) => {
    writer.on("finish", resolve)
    writer.on("error", reject)
  })

  const actualSha256 = await sha256File(TMP_MODEL_PATH)
  if (actualSha256 !== EXPECTED_SHA256) {
    rmSync(TMP_MODEL_PATH, { force: true })
    throw new Error(
      `Downloaded model checksum mismatch. Expected ${EXPECTED_SHA256}, got ${actualSha256}.`
    )
  }

  // Atomic rename
  renameSync(TMP_MODEL_PATH, MODEL_PATH)

  console.log(`\nWhisper model downloaded: ${MODEL_PATH}`)
}

const isMainModule =
  process.argv[1] != null &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  main().catch((e) => {
    console.error("Failed to download Whisper model:", e)
    process.exit(1)
  })
}
