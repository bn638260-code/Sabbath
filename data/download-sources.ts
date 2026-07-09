/**
 * Downloads Bible source data: a pre-built zip of legacy translations from
 * Google Drive, the public-domain WEB source from eBible.org, plus the
 * cross-references dataset from openbible.info.
 *
 * Run: bun run data/download-sources.ts
 */

import { mkdir, rm } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join } from "node:path"

const DATA_DIR = import.meta.dir
const SOURCES_DIR = join(DATA_DIR, "sources")
const CROSS_REFS_DIR = join(DATA_DIR, "cross-refs")
const WEB_SOURCE_JSON = "WEB.json"

// Pre-built zip of all 10 translations (~74 MB uncompressed). The `confirm=t`
// query param bypasses Google Drive's "can't scan for viruses" interstitial
// that would otherwise return an HTML page for files >100 MB.
const SOURCES_ZIP_URL =
  "https://drive.google.com/uc?export=download&id=1HQiNf_nCVRQrMbdmzVG7vq-Fvfqh1nzW&confirm=t"

const PREBUILT_TRANSLATIONS = [
  "KJV.json",
  "NIV.json",
  "ESV.json",
  "NASB.json",
  "NKJV.json",
  "NLT.json",
  "AMP.json",
  "SpaRV.json",
  "FreJND.json",
  "PorBLivre.json",
]
const WEB_VPL_URL = "https://ebible.org/Scriptures/engwebp_vpl.zip"
const WEB_VPL_DIR = "engwebp_vpl"
const WEB_VPL_FILE = "engwebp_vpl.txt"

const VPL_BOOK_NAMES: Record<string, string> = {
  GEN: "Genesis", EXO: "Exodus", LEV: "Leviticus", NUM: "Numbers",
  DEU: "Deuteronomy", JOS: "Joshua", JDG: "Judges", RUT: "Ruth",
  "1SA": "1 Samuel", "2SA": "2 Samuel", "1KI": "1 Kings", "2KI": "2 Kings",
  "1CH": "1 Chronicles", "2CH": "2 Chronicles", EZR: "Ezra", NEH: "Nehemiah",
  EST: "Esther", JOB: "Job", PSA: "Psalms", PRO: "Proverbs", ECC: "Ecclesiastes",
  SOL: "Song of Solomon", ISA: "Isaiah", JER: "Jeremiah", LAM: "Lamentations",
  EZE: "Ezekiel", DAN: "Daniel", HOS: "Hosea", JOE: "Joel", AMO: "Amos",
  OBA: "Obadiah", JON: "Jonah", MIC: "Micah", NAH: "Nahum", HAB: "Habakkuk",
  ZEP: "Zephaniah", HAG: "Haggai", ZEC: "Zechariah", MAL: "Malachi",
  MAT: "Matthew", MAR: "Mark", LUK: "Luke", JOH: "John", ACT: "Acts",
  ROM: "Romans", "1CO": "1 Corinthians", "2CO": "2 Corinthians", GAL: "Galatians",
  EPH: "Ephesians", PHI: "Philippians", COL: "Colossians", "1TH": "1 Thessalonians",
  "2TH": "2 Thessalonians", "1TI": "1 Timothy", "2TI": "2 Timothy", TIT: "Titus",
  PHM: "Philemon", HEB: "Hebrews", JAM: "James", "1PE": "1 Peter",
  "2PE": "2 Peter", "1JO": "1 John", "2JO": "2 John", "3JO": "3 John",
  JUD: "Jude", REV: "Revelation",
}

/** Manual-only source — run `bun run convert:afrikaans-bible` before building. */
const MANUAL_TRANSLATIONS = ["Afr1953.json"]

const CROSS_REFS_URL = "https://a.openbible.info/data/cross-references.zip"

async function downloadFile(url: string, dest: string): Promise<void> {
  console.log(`  Downloading ${url}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`)
  const buffer = await res.arrayBuffer()
  await Bun.write(dest, buffer)
  const sizeMB = (buffer.byteLength / 1024 / 1024).toFixed(1)
  console.log(`  ✓ Saved ${dest} (${sizeMB} MB)`)
}

function isZip(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 && // P
    bytes[1] === 0x4b && // K
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  )
}

async function spawnChecked(cmd: string[]): Promise<number> {
  const proc = Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit" })
  return proc.exited
}

/** Extract a zip without requiring the Unix `unzip` binary (missing on Windows by default). */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
  // `tar` ships with Windows 10+, macOS, and most Linux distros.
  try {
    const tarExit = await spawnChecked(["tar", "-xf", zipPath, "-C", destDir])
    if (tarExit === 0) return
  } catch {
    // tar not on PATH — try fallbacks below
  }

  try {
    const unzipExit = await spawnChecked(["unzip", "-o", zipPath, "-d", destDir])
    if (unzipExit === 0) return
  } catch {
    // unzip not on PATH
  }

  if (process.platform === "win32") {
    const escapedZip = zipPath.replace(/'/g, "''")
    const escapedDest = destDir.replace(/'/g, "''")
    const psExit = await spawnChecked([
      "powershell",
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDest}' -Force`,
    ])
    if (psExit === 0) return
  }

  throw new Error(
    `Failed to extract ${zipPath}. Ensure tar, unzip, or PowerShell Expand-Archive is available.`,
  )
}

async function downloadSourcesZip(): Promise<void> {
  const allPresent = PREBUILT_TRANSLATIONS.every((f) =>
    existsSync(join(SOURCES_DIR, f))
  )
  if (allPresent) {
    console.log("  ⏭ Pre-built translations already present, skipping zip download")
    return
  }

  // Stage the zip in DATA_DIR so it extracts as `data/sources/...` (the zip's
  // internal layout has a top-level `sources/` directory).
  const zipDest = join(DATA_DIR, "sources.zip")
  await downloadFile(SOURCES_ZIP_URL, zipDest)

  // Validate that we got a real zip and not Google Drive's HTML interstitial
  // (happens if the file ID is wrong, the file is private, or quota exceeded).
  const head = new Uint8Array(await Bun.file(zipDest).slice(0, 4).arrayBuffer())
  if (!isZip(head)) {
    await rm(zipDest, { force: true })
    throw new Error(
      "Google Drive returned a non-zip response (likely an HTML page). " +
        "Verify the file's sharing is set to 'Anyone with the link' and that " +
        "the daily download quota has not been exceeded."
    )
  }

  console.log("  📦 Extracting sources.zip...")
  await extractZip(zipDest, DATA_DIR)
  await rm(zipDest, { force: true })
  await rm(join(DATA_DIR, "__MACOSX"), { recursive: true, force: true })

  const missing = PREBUILT_TRANSLATIONS.filter(
    (f) => !existsSync(join(SOURCES_DIR, f))
  )
  if (missing.length > 0) {
    throw new Error(
      `Zip extracted but missing expected files: ${missing.join(", ")}`
    )
  }
  console.log(`  ✓ Extracted ${PREBUILT_TRANSLATIONS.length} pre-built translations`)
}

type VplVerse = { verse: number; text: string }
type VplChapter = { chapter: number; verses: VplVerse[] }
type VplBook = { name: string; chapters: VplChapter[] }

function convertWebVpl(vplText: string): { translation: string; books: VplBook[] } {
  const books: VplBook[] = []
  const booksByCode = new Map<string, VplBook>()
  const chaptersByBook = new Map<string, Map<number, VplChapter>>()

  for (const [lineIndex, line] of vplText.split(/\r?\n/).entries()) {
    if (!line.trim()) continue
    const match = /^([1-3]?[A-Z]{2,3}) (\d+):(\d+) (.*)$/.exec(line)
    if (!match) {
      throw new Error(`Unexpected WEB VPL line ${lineIndex + 1}: ${line}`)
    }

    const [, code, chapterText, verseText, text] = match
    const bookName = VPL_BOOK_NAMES[code]
    if (!bookName) {
      throw new Error(`Unsupported WEB VPL book code ${code} on line ${lineIndex + 1}`)
    }

    let book = booksByCode.get(code)
    if (!book) {
      book = { name: bookName, chapters: [] }
      booksByCode.set(code, book)
      chaptersByBook.set(code, new Map())
      books.push(book)
    }

    const chapterNumber = Number(chapterText)
    const verseNumber = Number(verseText)
    const chapterMap = chaptersByBook.get(code)
    if (!chapterMap) {
      throw new Error(`Missing chapter map for ${code}`)
    }

    let chapter = chapterMap.get(chapterNumber)
    if (!chapter) {
      chapter = { chapter: chapterNumber, verses: [] }
      chapterMap.set(chapterNumber, chapter)
      book.chapters.push(chapter)
    }

    chapter.verses.push({ verse: verseNumber, text: text.trim() })
  }

  return {
    translation: "WEB: World English Bible",
    books,
  }
}

async function downloadWebSource(): Promise<void> {
  const webJsonPath = join(SOURCES_DIR, WEB_SOURCE_JSON)
  const existing = Bun.file(webJsonPath)
  if ((await existing.exists()) && existing.size > 1000) {
    console.log("  ⏭ WEB.json already exists, skipping")
    return
  }

  const zipDest = join(SOURCES_DIR, "engwebp_vpl.zip")
  const extractDir = join(SOURCES_DIR, WEB_VPL_DIR)
  await rm(extractDir, { recursive: true, force: true })
  await downloadFile(WEB_VPL_URL, zipDest)

  const head = new Uint8Array(await Bun.file(zipDest).slice(0, 4).arrayBuffer())
  if (!isZip(head)) {
    await rm(zipDest, { force: true })
    throw new Error("eBible returned a non-zip response for WEB VPL data")
  }

  await mkdir(extractDir, { recursive: true })
  await extractZip(zipDest, extractDir)
  const vplText = await Bun.file(join(extractDir, WEB_VPL_FILE)).text()
  const data = convertWebVpl(vplText)
  const verseCount = data.books.reduce(
    (total, book) =>
      total + book.chapters.reduce((bookTotal, chapter) => bookTotal + chapter.verses.length, 0),
    0,
  )

  await Bun.write(webJsonPath, `${JSON.stringify(data, null, 2)}\n`)
  await rm(zipDest, { force: true })
  await rm(extractDir, { recursive: true, force: true })
  console.log(`  ✓ Converted WEB: ${data.books.length} books, ${verseCount} verses`)
}

async function downloadCrossRefs(): Promise<void> {
  const crossRefFile = join(CROSS_REFS_DIR, "cross_references.txt")
  const existing = Bun.file(crossRefFile)
  if ((await existing.exists()) && existing.size > 1000) {
    console.log("  ⏭ cross_references.txt already exists, skipping")
    return
  }

  const zipDest = join(CROSS_REFS_DIR, "cross-references.zip")
  await downloadFile(CROSS_REFS_URL, zipDest)
  await extractZip(zipDest, CROSS_REFS_DIR)
  await rm(zipDest, { force: true })
}

async function main() {
  await mkdir(SOURCES_DIR, { recursive: true })
  await mkdir(CROSS_REFS_DIR, { recursive: true })

  console.log("\n📖 Downloading Bible translations (pre-built zip)...\n")
  await downloadSourcesZip()

  console.log("\n📖 Downloading World English Bible...\n")
  await downloadWebSource()

  console.log("\n🔗 Downloading cross-references...\n")
  await downloadCrossRefs()

  console.log("\n✅ All source data downloaded!\n")
  const missingManual = MANUAL_TRANSLATIONS.filter(
    (f) => !existsSync(join(SOURCES_DIR, f)),
  )
  if (missingManual.length > 0) {
    console.log(
      "ℹ️  Optional manual translations missing:",
      missingManual.join(", "),
    )
    console.log("   Run: bun run convert:afrikaans-bible\n")
  }
}

main().catch((err) => {
  console.error("❌ Download failed:", err)
  process.exit(1)
})
