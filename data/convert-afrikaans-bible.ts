/**
 * Converts godlytalias Bible-Database Afrikaans JSON to Scrollmapper format.
 *
 * Source: https://github.com/godlytalias/Bible-Database (GPL v3)
 * Text: 1933/1953 Afrikaans Bybel (© Bible Society of South Africa)
 *
 * Run: bun run data/convert-afrikaans-bible.ts
 */

import { mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join } from "node:path"

const DATA_DIR = import.meta.dir
const SOURCES_DIR = join(DATA_DIR, "sources")
const OUTPUT_PATH = join(SOURCES_DIR, "Afr1953.json")

const SOURCE_URL =
  "https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Afrikaans/bible.json"

/** Book order matches godlytalias Verseid encoding (0-based book index). */
const AF_BOOK_NAMES = [
  "Genesis",
  "Eksodus",
  "Levitikus",
  "Numeri",
  "Deuteronomium",
  "Josua",
  "Rigters",
  "Rut",
  "1 Samuel",
  "2 Samuel",
  "1 Konings",
  "2 Konings",
  "1 Kronieke",
  "2 Kronieke",
  "Esra",
  "Nehemia",
  "Ester",
  "Job",
  "Psalms",
  "Spreuke van Salomo",
  "Prediker",
  "Hooglied van Salomo",
  "Jesaja",
  "Jeremia",
  "Klaagliedere van Jeremia",
  "Esegiël",
  "Daniël",
  "Hosea",
  "Joël",
  "Amos",
  "Obadja",
  "Jona",
  "Miga",
  "Nahum",
  "Habakuk",
  "Sefanja",
  "Haggai",
  "Sagaria",
  "Maleagi",
  "Matteus",
  "Markus",
  "Lukas",
  "Johannes",
  "Die handelinge van die apostels",
  "Romeine",
  "1 Korintiërs",
  "2 Korintiërs",
  "Galasiërs",
  "Effesiërs",
  "Filippense",
  "Kolossense",
  "1 Tessalonisense",
  "2 Tessalonisense",
  "1 Timoteus",
  "2 Timoteus",
  "Titus",
  "Filemon",
  "Hebreërs",
  "Jakobus",
  "1 Petrus",
  "2 Petrus",
  "1 Johannes",
  "2 Johannes",
  "3 Johannes",
  "Judas",
  "Die openbaring",
] as const

type GodlytaliasVerse = { Verseid?: string; Verse: string }
type GodlytaliasChapter = { Verse: GodlytaliasVerse[] }
type GodlytaliasBook = { Chapter: GodlytaliasChapter[] }
type GodlytaliasJSON = { Book: GodlytaliasBook[] }

type ScrollmapperJSON = {
  translation: { name: string; abbreviation: string }
  books: Array<{
    name: string
    chapters: Array<{
      chapter: number
      verses: Array<{ verse: number; text: string }>
    }>
  }>
}

function cleanVerseText(text: string): string {
  return text.replace(/^"+|"+$/g, "").trim()
}

async function downloadSource(): Promise<GodlytaliasJSON> {
  console.log(`  Downloading ${SOURCE_URL}...`)
  const res = await fetch(SOURCE_URL)
  if (!res.ok) {
    throw new Error(`Failed to download Afrikaans Bible: HTTP ${res.status}`)
  }
  return (await res.json()) as GodlytaliasJSON
}

function convert(data: GodlytaliasJSON): ScrollmapperJSON {
  if (!Array.isArray(data.Book) || data.Book.length !== AF_BOOK_NAMES.length) {
    throw new Error(
      `Expected ${AF_BOOK_NAMES.length} books, got ${data.Book?.length ?? 0}`,
    )
  }

  const books = data.Book.map((book, bookIdx) => {
    const chapters = book.Chapter.map((chapter, chapterIdx) => {
      const verses = chapter.Verse.map((entry, verseIdx) => ({
        verse: verseIdx + 1,
        text: cleanVerseText(entry.Verse),
      }))
      return { chapter: chapterIdx + 1, verses }
    })

    return {
      name: AF_BOOK_NAMES[bookIdx] ?? `Book ${bookIdx + 1}`,
      chapters,
    }
  })

  return {
    translation: {
      name: "Afrikaans 1933/1953 Bybel",
      abbreviation: "Afr1953",
    },
    books,
  }
}

async function main() {
  await mkdir(SOURCES_DIR, { recursive: true })

  if (existsSync(OUTPUT_PATH)) {
    const existing = Bun.file(OUTPUT_PATH)
    if (existing.size > 500_000) {
      console.log(`  ⏭ ${OUTPUT_PATH} already exists, skipping conversion`)
      return
    }
  }

  console.log("\n📖 Converting Afrikaans Bible to Scrollmapper JSON...\n")
  const source = await downloadSource()
  const output = convert(source)
  await Bun.write(OUTPUT_PATH, JSON.stringify(output, null, 2))

  const sizeMB = (Bun.file(OUTPUT_PATH).size / 1024 / 1024).toFixed(1)
  console.log(`  ✓ Wrote ${OUTPUT_PATH} (${sizeMB} MB, ${output.books.length} books)\n`)
}

main().catch((err) => {
  console.error("❌ Afrikaans Bible conversion failed:", err)
  process.exit(1)
})
