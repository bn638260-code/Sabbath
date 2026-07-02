/// <reference types="bun-types" />
/**
 * Prepares canonical verse text for semantic embeddings.
 *
 * The semantic index stores one vector per Bible reference, keyed by the KJV
 * verse row id. Only redistributable translations are blended so locked
 * licensed editions are not used for detection.
 *
 * Usage:
 * 1. Run: bun run data/download-model.ts
 * 2. Run: bun run data/compute-embeddings.ts
 * 3. Run: cargo run -p rhema-detection --features onnx,vector-search --bin precompute -- \
 *        --model models/minilm-l6-v2-int8/onnx/model_quantized.onnx \
 *        --tokenizer models/minilm-l6-v2/tokenizer.json \
 *        --verses data/verses-for-embedding.json \
 *        --output-embeddings embeddings/public-minilm-l6-v2.bin \
 *        --output-ids embeddings/public-minilm-l6-v2-ids.bin
 */

import { Database } from "bun:sqlite"
import { mkdir } from "node:fs/promises"
import { join } from "node:path"

const DATA_DIR = import.meta.dir
const DB_PATH = join(DATA_DIR, "rhema.db")
const OUTPUT_PATH = join(DATA_DIR, "verses-for-embedding.json")
const EMBEDDING_TRANSLATIONS = ["KJV", "SpaRV", "FreJND", "PorBLivre"] as const

type TranslationRow = {
  id: number
  abbreviation: string
}

type VerseRow = {
  id: number
  translation_id: number
  book_number: number
  book_name: string
  chapter: number
  verse: number
  text: string
}

function verseKey(bookNumber: number, chapter: number, verse: number): string {
  return `${bookNumber}:${chapter}:${verse}`
}

async function main() {
  await mkdir(join(DATA_DIR, "..", "embeddings"), { recursive: true })

  console.log("\nExporting redistributable verses for embedding...\n")

  const db = new Database(DB_PATH, { readonly: true })

  const placeholders = EMBEDDING_TRANSLATIONS.map(() => "?").join(", ")
  const translationRows = db
    .query(
      `SELECT id, abbreviation FROM translations WHERE abbreviation IN (${placeholders})`,
    )
    .all(...EMBEDDING_TRANSLATIONS) as TranslationRow[]

  const translations = EMBEDDING_TRANSLATIONS.map((abbreviation) =>
    translationRows.find((row) => row.abbreviation === abbreviation),
  ).filter((row): row is TranslationRow => Boolean(row))

  const kjvRow = translations.find((row) => row.abbreviation === "KJV")
  if (!kjvRow) {
    throw new Error(
      "KJV translation not found in rhema.db - run build:bible first",
    )
  }

  const missing = EMBEDDING_TRANSLATIONS.filter(
    (abbreviation) =>
      !translations.some((row) => row.abbreviation === abbreviation),
  )
  if (missing.length > 0) {
    console.log(`  Missing optional translations: ${missing.join(", ")}`)
  }
  console.log(
    `  Using translations: ${translations
      .map((row) => row.abbreviation)
      .join(", ")}`,
  )

  const kjvVerses = db
    .query(
      "SELECT id, translation_id, book_number, book_name, chapter, verse, text FROM verses WHERE translation_id = ? ORDER BY book_number, chapter, verse",
    )
    .all(kjvRow.id) as VerseRow[]

  const translationIds = translations.map((row) => row.id)
  const idPlaceholders = translationIds.map(() => "?").join(", ")
  const translationNamesById = new Map(
    translations.map((row) => [row.id, row.abbreviation]),
  )
  const verseRows = db
    .query(
      `SELECT id, translation_id, book_number, book_name, chapter, verse, text FROM verses WHERE translation_id IN (${idPlaceholders}) ORDER BY translation_id, book_number, chapter, verse`,
    )
    .all(...translationIds) as VerseRow[]

  const textByReference = new Map<string, Map<string, string>>()
  for (const row of verseRows) {
    const abbreviation = translationNamesById.get(row.translation_id)
    if (!abbreviation) continue

    const key = verseKey(row.book_number, row.chapter, row.verse)
    const texts = textByReference.get(key) ?? new Map<string, string>()
    texts.set(abbreviation, row.text)
    textByReference.set(key, texts)
  }

  console.log(`  Found ${kjvVerses.length} canonical KJV verse references`)

  const output = kjvVerses.map((verse) => {
    const texts = textByReference.get(
      verseKey(verse.book_number, verse.chapter, verse.verse),
    )
    const blendedText = translations
      .map((translation) => texts?.get(translation.abbreviation))
      .filter((text): text is string => Boolean(text && text.trim()))
      .join(" ")

    return {
      id: verse.id,
      text: blendedText || verse.text,
      ref: `${verse.book_name} ${verse.chapter}:${verse.verse}`,
    }
  })

  await Bun.write(OUTPUT_PATH, JSON.stringify(output))
  console.log(`  Exported to ${OUTPUT_PATH}`)
  console.log(
    "\n  Next: run the embedding precompute step to generate the binary index.\n",
  )

  db.close()
}

main().catch((err) => {
  console.error("Export failed:", err)
  process.exit(1)
})
