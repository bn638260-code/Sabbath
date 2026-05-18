import { Database } from "bun:sqlite"
import { join } from "node:path"

const dbPath = join(import.meta.dir, "..", "data", "rhema.db")
const db = new Database(dbPath, { readonly: true })

const rows = db
  .query<{ abbreviation: string; license: string; is_copyrighted: number }, []>(
    "SELECT abbreviation, license, is_copyrighted FROM translations ORDER BY id",
  )
  .all()

const allowed = new Set(["KJV", "SpaRV", "FreJND", "PorBLivre"])
const unexpected = rows.filter((row) => !allowed.has(row.abbreviation))
const copyrighted = rows.filter((row) => row.is_copyrighted !== 0)

if (unexpected.length > 0 || copyrighted.length > 0) {
  console.error("Public DB verification failed.")
  console.error("Rows:", rows)
  process.exit(1)
}

if (rows.length !== allowed.size) {
  console.error(`Expected ${allowed.size} translations, found ${rows.length}.`)
  console.error("Rows:", rows)
  process.exit(1)
}

console.log("Public DB verification passed:")
for (const row of rows) {
  console.log(`- ${row.abbreviation} (${row.license})`)
}

db.close()
