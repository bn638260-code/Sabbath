/**
 * Builds rhema.db from Bible JSON sources + cross-references.
 * Run: bun run data/build-bible-db.ts
 * Prereq: bun run data/download-sources.ts
 */

import { Database } from "bun:sqlite"
import { readFileSync, unlinkSync } from "node:fs"
import { join } from "node:path"

const DATA_DIR = import.meta.dir
const DB_PATH = join(DATA_DIR, "rhema.db")
const SCHEMA_PATH = join(DATA_DIR, "schema.sql")
const SOURCES_DIR = join(DATA_DIR, "sources")
const CROSS_REFS_PATH = join(DATA_DIR, "cross-refs", "cross_references.txt")

const OSIS_TO_NUM: Record<string, number> = {
  Gen: 1, Exod: 2, Lev: 3, Num: 4, Deut: 5, Josh: 6, Judg: 7, Ruth: 8,
  "1Sam": 9, "2Sam": 10, "1Kgs": 11, "2Kgs": 12, "1Chr": 13, "2Chr": 14,
  Ezra: 15, Neh: 16, Esth: 17, Job: 18, Ps: 19, Prov: 20, Eccl: 21,
  Song: 22, Isa: 23, Jer: 24, Lam: 25, Ezek: 26, Dan: 27, Hos: 28,
  Joel: 29, Amos: 30, Obad: 31, Jonah: 32, Mic: 33, Nah: 34, Hab: 35,
  Zeph: 36, Hag: 37, Zech: 38, Mal: 39, Matt: 40, Mark: 41, Luke: 42,
  John: 43, Acts: 44, Rom: 45, "1Cor": 46, "2Cor": 47, Gal: 48, Eph: 49,
  Phil: 50, Col: 51, "1Thess": 52, "2Thess": 53, "1Tim": 54, "2Tim": 55,
  Titus: 56, Phlm: 57, Heb: 58, Jas: 59, "1Pet": 60, "2Pet": 61,
  "1John": 62, "2John": 63, "3John": 64, Jude: 65, Rev: 66,
}

const BOOK_ABBREVS: Record<string, string> = {
  Genesis: "Gen", Exodus: "Exod", Leviticus: "Lev", Numbers: "Num",
  Deuteronomy: "Deut", Joshua: "Josh", Judges: "Judg", Ruth: "Ruth",
  "1 Samuel": "1Sam", "2 Samuel": "2Sam", "1 Kings": "1Kgs", "2 Kings": "2Kgs",
  "1 Chronicles": "1Chr", "2 Chronicles": "2Chr", Ezra: "Ezra", Nehemiah: "Neh",
  Esther: "Esth", Job: "Job", Psalms: "Ps", Proverbs: "Prov",
  Ecclesiastes: "Eccl", "Song of Solomon": "Song", Isaiah: "Isa", Jeremiah: "Jer",
  Lamentations: "Lam", Ezekiel: "Ezek", Daniel: "Dan", Hosea: "Hos",
  Joel: "Joel", Amos: "Amos", Obadiah: "Obad", Jonah: "Jonah",
  Micah: "Mic", Nahum: "Nah", Habakkuk: "Hab", Zephaniah: "Zeph",
  Haggai: "Hag", Zechariah: "Zech", Malachi: "Mal", Matthew: "Matt",
  Mark: "Mark", Luke: "Luke", John: "John", Acts: "Acts", Romans: "Rom",
  "1 Corinthians": "1Cor", "2 Corinthians": "2Cor", Galatians: "Gal",
  Ephesians: "Eph", Philippians: "Phil", Colossians: "Col",
  "1 Thessalonians": "1Thess", "2 Thessalonians": "2Thess",
  "1 Timothy": "1Tim", "2 Timothy": "2Tim", Titus: "Titus", Philemon: "Phlm",
  Hebrews: "Heb", James: "Jas", "1 Peter": "1Pet", "2 Peter": "2Pet",
  "1 John": "1John", "2 John": "2John", "3 John": "3John", Jude: "Jude",
  Revelation: "Rev",
}

interface ScrollmapperJSON {
  translation: { name?: string; abbreviation?: string }
  books: Array<{
    name: string
    chapters: Array<{
      chapter: number
      verses: Array<{ verse: number; text: string }>
    }>
  }>
}

const PUBLIC_RELEASE = process.env.SABBATHCUE_PUBLIC_RELEASE === "1"

const TRANSLATIONS_META: Array<{
  file: string
  abbreviation: string
  title: string
  language: string
  license: string
  isCopyrighted: boolean
  includeInPublicRelease: boolean
}> = [
  { file: "KJV.json", abbreviation: "KJV", title: "King James Version", language: "en", license: "Public Domain", isCopyrighted: false, includeInPublicRelease: true },
  { file: "NIV.json", abbreviation: "NIV", title: "New International Version", language: "en", license: "Biblica", isCopyrighted: true, includeInPublicRelease: true },
  { file: "ESV.json", abbreviation: "ESV", title: "English Standard Version", language: "en", license: "Crossway", isCopyrighted: true, includeInPublicRelease: true },
  { file: "NASB.json", abbreviation: "NASB", title: "New American Standard Bible", language: "en", license: "Lockman Foundation", isCopyrighted: true, includeInPublicRelease: true },
  { file: "NKJV.json", abbreviation: "NKJV", title: "New King James Version", language: "en", license: "Thomas Nelson", isCopyrighted: true, includeInPublicRelease: true },
  { file: "NLT.json", abbreviation: "NLT", title: "New Living Translation", language: "en", license: "Tyndale House", isCopyrighted: true, includeInPublicRelease: true },
  { file: "AMP.json", abbreviation: "AMP", title: "Amplified Bible", language: "en", license: "Lockman Foundation", isCopyrighted: true, includeInPublicRelease: true },
  { file: "SpaRV.json", abbreviation: "SpaRV", title: "Reina-Valera 1909", language: "es", license: "Public Domain", isCopyrighted: false, includeInPublicRelease: true },
  { file: "FreJND.json", abbreviation: "FreJND", title: "J.N. Darby French 1885", language: "fr", license: "Public Domain", isCopyrighted: false, includeInPublicRelease: true },
  { file: "PorBLivre.json", abbreviation: "PorBLivre", title: "Biblia Livre", language: "pt", license: "Public Domain", isCopyrighted: false, includeInPublicRelease: true },
]

type ParsedOsis = { book: number; chapter: number; verse: number }
type ParsedOsisRange = { start: ParsedOsis; end: ParsedOsis }

function resetDatabase(): Database {
  try {
    unlinkSync(DB_PATH)
  } catch {
    // The database may not exist yet on a fresh build.
  }
  return new Database(DB_PATH, { create: true })
}

function createSchema(db: Database): void {
  const schema = readFileSync(SCHEMA_PATH, "utf-8")
  const statements = schema.split(";").map((s) => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    db.exec(stmt + ";")
  }
}

function insertTranslationData(db: Database, meta: (typeof TRANSLATIONS_META)[number]): void {
  if (PUBLIC_RELEASE && !meta.includeInPublicRelease) {
    console.log(`  skipped ${meta.abbreviation}: public release`)
    return
  }

  const filePath = join(SOURCES_DIR, meta.file)
  let raw: string
  try {
    raw = readFileSync(filePath, "utf-8")
  } catch {
    console.log(`  skipped ${meta.file}: not found`)
    return
  }

  const data: ScrollmapperJSON = JSON.parse(raw)
  const insertTranslation = db.prepare(
    "INSERT INTO translations (abbreviation, title, language, license, is_copyrighted, is_downloaded) VALUES (?, ?, ?, ?, ?, ?)"
  )
  const insertBook = db.prepare(
    "INSERT INTO books (translation_id, book_number, name, abbreviation, testament) VALUES (?, ?, ?, ?, ?)"
  )
  const insertVerse = db.prepare(
    "INSERT INTO verses (translation_id, book_id, book_number, book_name, book_abbreviation, chapter, verse, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )

  db.exec("BEGIN TRANSACTION")
  insertTranslation.run(
    meta.abbreviation,
    meta.title,
    meta.language,
    meta.license,
    meta.isCopyrighted ? 1 : 0,
    1,
  )
  const translation = db.query("SELECT last_insert_rowid() as id").get() as { id: number }
  let verseCount = 0

  for (let bookIdx = 0; bookIdx < data.books.length; bookIdx++) {
    const book = data.books[bookIdx]
    const abbrev = BOOK_ABBREVS[book.name] || book.name.substring(0, 4)
    const bookNumber = OSIS_TO_NUM[abbrev] ?? bookIdx + 1
    const testament = bookNumber <= 39 ? "OT" : "NT"
    insertBook.run(translation.id, bookNumber, book.name, abbrev, testament)
    const bookResult = db.query("SELECT last_insert_rowid() as id").get() as { id: number }

    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        insertVerse.run(translation.id, bookResult.id, bookNumber, book.name, abbrev, chapter.chapter, verse.verse, verse.text)
        verseCount++
      }
    }
  }

  db.exec("COMMIT")
  console.log(`  ${meta.abbreviation}: ${data.books.length} books, ${verseCount} verses`)
}

function importTranslations(db: Database): void {
  for (const meta of TRANSLATIONS_META) {
    console.log(`  Processing ${meta.abbreviation}...`)
    insertTranslationData(db, meta)
  }
}

function buildSearchIndex(db: Database): void {
  console.log("\n  Building FTS5 search index...")
  db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(text, content='verses', content_rowid='id', tokenize='unicode61');")
  db.exec("INSERT INTO verses_fts(rowid, text) SELECT id, text FROM verses;")
}

function parseOsis(ref: string): ParsedOsis | null {
  const parts = ref.split(".")
  if (parts.length !== 3) return null
  const chapter = parseInt(parts[1])
  const verse = parseInt(parts[2])
  const book = OSIS_TO_NUM[parts[0]]
  if (!book || isNaN(chapter) || isNaN(verse)) return null
  return { book, chapter, verse }
}

function parseOsisRange(ref: string): ParsedOsisRange | null {
  const [startRef, endRef] = ref.split("-", 2)
  const start = parseOsis(startRef)
  if (!start) return null
  if (!endRef) return { start, end: start }

  const end = parseOsis(endRef)
  if (!end) return null
  if (end.book !== start.book || end.chapter !== start.chapter) return null
  return { start, end }
}

function importCrossReferences(db: Database): void {
  console.log("\n  Importing cross-references...")
  let raw: string
  try {
    raw = readFileSync(CROSS_REFS_PATH, "utf-8")
  } catch {
    console.log("  skipped cross_references.txt: not found")
    return
  }

  const insertCrossRef = db.prepare(
    "INSERT INTO cross_references (from_book, from_chapter, from_verse, to_book, to_chapter, to_verse_start, to_verse_end, votes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  )
  db.exec("BEGIN TRANSACTION")
  let count = 0

  for (const line of raw.split("\n")) {
    if (line.startsWith("From") || line.startsWith("#") || !line.trim()) continue
    const [fromStr, toStr, votesStr] = line.split("\t")
    const from = parseOsis(fromStr)
    const to = parseOsisRange(toStr)
    if (!from || !to) continue

    insertCrossRef.run(
      from.book,
      from.chapter,
      from.verse,
      to.start.book,
      to.start.chapter,
      to.start.verse,
      to.end.verse,
      parseInt(votesStr) || 0,
    )
    count++
  }

  db.exec("COMMIT")
  console.log(`  ${count.toLocaleString()} cross-references imported`)
}

function optimizeDatabase(db: Database): void {
  console.log("\n  Optimizing database...")
  db.exec("PRAGMA optimize;")
  db.exec("ANALYZE;")
}

function logStats(db: Database): void {
  const verseTotal = db.query("SELECT COUNT(*) as c FROM verses").get() as { c: number }
  const transTotal = db.query("SELECT COUNT(*) as c FROM translations").get() as { c: number }
  const crossTotal = db.query("SELECT COUNT(*) as c FROM cross_references").get() as { c: number }

  console.log("\nrhema.db built successfully")
  console.log(`   ${transTotal.c} translations`)
  console.log(`   ${verseTotal.c.toLocaleString()} verses`)
  console.log(`   ${crossTotal.c.toLocaleString()} cross-references`)
  console.log(`   ${DB_PATH}\n`)
}

function main(): void {
  console.log("\nBuilding rhema.db...\n")
  const db = resetDatabase()
  createSchema(db)
  importTranslations(db)
  buildSearchIndex(db)
  importCrossReferences(db)
  optimizeDatabase(db)
  logStats(db)
  db.close()
}

main()
