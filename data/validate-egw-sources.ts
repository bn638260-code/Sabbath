import { readFileSync } from "node:fs"
import { join } from "node:path"

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

const FORBIDDEN_TEXT = [
  "Overview\n Great Controversy",
  "Read online\n Listen to audio book",
  "Site published by",
  "font-family:",
  "background-color:",
  "text-decoration:",
  "/* List Definitions */",
] as const

const EXPECTED = [
  {
    abbreviation: "PP",
    chapters: 73,
    file: "patriarchs-and-prophets.json",
  },
  {
    abbreviation: "SC",
    chapters: 13,
    file: "steps-to-christ.json",
  },
  {
    abbreviation: "DA",
    chapters: 87,
    file: "the-desire-of-ages.json",
  },
] as const

function main() {
  for (const book of EXPECTED) {
    const path = join(import.meta.dir, "sources", "egw", book.file)
    const source = JSON.parse(readFileSync(path, "utf8")) as EgwSource

    if (source.abbreviation !== book.abbreviation) {
      throw new Error(`Expected ${book.abbreviation} in ${book.file}`)
    }
    if (source.chapters.length !== book.chapters) {
      throw new Error(
        `${book.abbreviation}: expected ${book.chapters} chapters, got ${source.chapters.length}`,
      )
    }

    for (let i = 0; i < source.chapters.length; i += 1) {
      const chapter = source.chapters[i]
      if (chapter.chapter !== i + 1) {
        throw new Error(
          `${book.abbreviation}: chapter sequence broken at ${i + 1}`,
        )
      }
      if (chapter.paragraphs.length === 0) {
        throw new Error(`${book.abbreviation} ${chapter.chapter}: chapter is empty`)
      }
      for (let j = 0; j < chapter.paragraphs.length; j += 1) {
        const paragraph = chapter.paragraphs[j]
        if (paragraph.paragraph !== j + 1) {
          throw new Error(
            `${book.abbreviation} ${chapter.chapter}: paragraph sequence broken at ${j + 1}`,
          )
        }
        if (!paragraph.text.trim()) {
          throw new Error(
            `${book.abbreviation} ${chapter.chapter}:${paragraph.paragraph} is empty`,
          )
        }
        for (const forbidden of FORBIDDEN_TEXT) {
          if (paragraph.text.includes(forbidden)) {
            throw new Error(
              `${book.abbreviation} ${chapter.chapter}:${paragraph.paragraph} contains site chrome: ${JSON.stringify(forbidden)}`,
            )
          }
        }
      }
    }

    console.log(`${book.abbreviation}=${source.chapters.length}`)
  }
}

main()
