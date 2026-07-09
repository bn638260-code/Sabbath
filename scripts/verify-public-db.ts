import { Database } from "bun:sqlite"
import { join } from "node:path"

const dbPath = join(import.meta.dir, "..", "data", "rhema.db")
const db = new Database(dbPath, { readonly: true })

const expected = [
  "KJV",
  "NIV",
  "ESV",
  "NASB",
  "NKJV",
  "NLT",
  "AMP",
  "SpaRV",
  "FreJND",
  "PorBLivre",
  "Afr1953",
  "WEB",
] as const

const expectedSet = new Set<string>(expected)

const rows = db
  .query<{ abbreviation: string; license: string; is_copyrighted: number }, []>(
    "SELECT abbreviation, license, is_copyrighted FROM translations ORDER BY id",
  )
  .all()

const abbreviations = rows.map((row) => row.abbreviation)
const unexpected = abbreviations.filter((abbreviation) => !expectedSet.has(abbreviation))
const missing = expected.filter((abbreviation) => !abbreviations.includes(abbreviation))

if (unexpected.length > 0 || missing.length > 0) {
  console.error("Public DB verification failed.")
  if (missing.length > 0) {
    console.error("Missing translations:", missing)
  }
  if (unexpected.length > 0) {
    console.error("Unexpected translations:", unexpected)
  }
  console.error("Rows:", rows)
  process.exit(1)
}

if (rows.length !== expected.length) {
  console.error(`Expected ${expected.length} translations, found ${rows.length}.`)
  console.error("Rows:", rows)
  process.exit(1)
}

console.log("Public DB verification passed:")
for (const row of rows) {
  console.log(`- ${row.abbreviation} (${row.license})`)
}

db.close()
