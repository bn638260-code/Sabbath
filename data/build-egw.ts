/**
 * Populates the egw_books / egw_paragraphs tables inside rhema.db from
 * Ellen G. White source JSON (chapter + paragraph addressing).
 *
 * Run: bun run build:egw
 * Prereq: bun run build:bible (creates rhema.db + empty egw_* tables).
 *
 * IMPORTANT: build:bible deletes and recreates rhema.db on every run, so this
 * script MUST be re-run after every build:bible.
 *
 * Required build order for packaged releases:
 *   1. bun run build:bible
 *   2. bun run build:egw
 */

import { Database } from "bun:sqlite"
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join } from "node:path"

const DATA_DIR = import.meta.dir
const DB_PATH = join(DATA_DIR, "rhema.db")
const EGW_SOURCES_DIR = join(DATA_DIR, "sources", "egw")

interface EgwSource {
  title: string
  abbreviation: string
  book_number: number
  chapters: Array<{
    chapter: number
    title: string
    paragraphs: Array<{ paragraph: number; text: string }>
  }>
}

function main() {
  if (!existsSync(DB_PATH)) {
    console.error("❌ rhema.db not found. Run 'bun run build:bible' first.")
    process.exit(1)
  }

  if (!existsSync(EGW_SOURCES_DIR)) {
    console.log("⏭ data/sources/egw not found — no EGW books to import. Skipping.")
    return
  }

  const files = readdirSync(EGW_SOURCES_DIR).filter((f) => f.endsWith(".json"))
  if (files.length === 0) {
    console.log("⏭ No EGW JSON sources found. Skipping.")
    return
  }

  const db = new Database(DB_PATH)

  // Ensure tables exist (idempotent — schema.sql also creates them).
  db.exec(
    "CREATE TABLE IF NOT EXISTS egw_books (id INTEGER PRIMARY KEY AUTOINCREMENT, book_number INTEGER NOT NULL UNIQUE, title TEXT NOT NULL, abbreviation TEXT NOT NULL, chapter_count INTEGER NOT NULL DEFAULT 0);"
  )
  db.exec(
    "CREATE TABLE IF NOT EXISTS egw_paragraphs (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL REFERENCES egw_books(id), book_number INTEGER NOT NULL, book_title TEXT NOT NULL, chapter INTEGER NOT NULL, chapter_title TEXT NOT NULL, paragraph INTEGER NOT NULL, text TEXT NOT NULL);"
  )
  db.exec("CREATE INDEX IF NOT EXISTS idx_egw_lookup ON egw_paragraphs(book_number, chapter, paragraph);")
  db.exec("CREATE INDEX IF NOT EXISTS idx_egw_chapter ON egw_paragraphs(book_number, chapter);")
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_egw_unique ON egw_paragraphs(book_number, chapter, paragraph);")

  const insertBook = db.prepare(
    "INSERT OR REPLACE INTO egw_books (book_number, title, abbreviation, chapter_count) VALUES (?, ?, ?, ?)"
  )
  const insertPara = db.prepare(
    "INSERT INTO egw_paragraphs (book_id, book_number, book_title, chapter, chapter_title, paragraph, text) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )

  let totalParagraphs = 0

  for (const file of files) {
    let src: EgwSource
    try {
      const raw = readFileSync(join(EGW_SOURCES_DIR, file), "utf-8")
      src = JSON.parse(raw) as EgwSource
    } catch (error) {
      console.error(`Failed to read EGW source ${file}`)
      throw error
    }

    console.log(`\n📘 Importing "${src.title}" (book_number ${src.book_number})...`)

    db.exec("BEGIN TRANSACTION")
    try {
      db.prepare("DELETE FROM egw_paragraphs WHERE book_number = ?").run(src.book_number)

      insertBook.run(src.book_number, src.title, src.abbreviation, src.chapters.length)
      const bookRow = db
        .query("SELECT id FROM egw_books WHERE book_number = ?")
        .get(src.book_number) as { id: number }

      for (const ch of src.chapters) {
        for (const p of ch.paragraphs) {
          insertPara.run(
            bookRow.id,
            src.book_number,
            src.title,
            ch.chapter,
            ch.title,
            p.paragraph,
            p.text
          )
          totalParagraphs++
        }
      }

      db.exec("COMMIT")
    } catch (error) {
      db.exec("ROLLBACK")
      throw error
    }
    console.log(`  ✓ ${src.chapters.length} chapters imported`)
  }

  // Rebuild the FTS5 index (external-content) from scratch.
  db.exec("DROP TABLE IF EXISTS egw_paragraphs_fts;")
  db.exec(
    "CREATE VIRTUAL TABLE egw_paragraphs_fts USING fts5(text, content='egw_paragraphs', content_rowid='id', tokenize='unicode61');"
  )
  db.exec("INSERT INTO egw_paragraphs_fts(rowid, text) SELECT id, text FROM egw_paragraphs;")

  db.exec("PRAGMA optimize;")
  db.exec("ANALYZE;")
  db.close()

  console.log(`\n✅ EGW import complete — ${totalParagraphs.toLocaleString()} paragraphs.\n`)
}

main()
