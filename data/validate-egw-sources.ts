import { readFileSync } from "node:fs"
import { join } from "node:path"

interface EgwSource {
  title: string
  abbreviation: string
  book_number: number
  chapters: Array<{
    chapter: number
    title: string
    paragraphs: Array<{
      paragraph: number
      page: number
      page_paragraph: number
      text: string
    }>
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
    minParasPerPage: 1.8,
    maxParagraphChars: 2250,
  },
  {
    abbreviation: "SC",
    chapters: 13,
    file: "steps-to-christ.json",
    minParasPerPage: 1.5,
  },
  {
    abbreviation: "DA",
    chapters: 87,
    file: "the-desire-of-ages.json",
    minParasPerPage: 1.8,
    maxParagraphChars: 2050,
  },
  {
    abbreviation: "Ed",
    chapters: 35,
    file: "education.json",
    minParasPerPage: 1.8,
  },
  {
    abbreviation: "GC",
    chapters: 42,
    file: "the-great-controversy.json",
    minParasPerPage: 1.8,
    maxParagraphChars: 2250,
  },
] as const

interface ParagraphStats {
  count: number
  parasPerPage: number
  median: number
  p90: number
  max: number
}

function paragraphStats(src: EgwSource): ParagraphStats {
  const lengths: number[] = []
  const perPage = new Map<number, number>()
  for (const chapter of src.chapters) {
    for (const paragraph of chapter.paragraphs) {
      lengths.push(paragraph.text.length)
      perPage.set(paragraph.page, (perPage.get(paragraph.page) ?? 0) + 1)
    }
  }
  lengths.sort((a, b) => a - b)
  const at = (q: number) => lengths[Math.min(lengths.length - 1, Math.floor(lengths.length * q))] ?? 0
  const totalPages = perPage.size
  return {
    count: lengths.length,
    parasPerPage: totalPages === 0 ? 0 : lengths.length / totalPages,
    median: at(0.5),
    p90: at(0.9),
    max: lengths[lengths.length - 1] ?? 0,
  }
}

const P90_MAX_CHARS = 1200
const HARD_MAX_CHARS = 2000

function assertParagraphQuality(
  abbreviation: string,
  stats: ParagraphStats,
  minParasPerPage: number,
  maxParagraphChars: number,
  errors: string[],
): void {
  if (stats.parasPerPage < minParasPerPage) {
    errors.push(
      `${abbreviation}: ${stats.parasPerPage.toFixed(2)} paragraphs/page < required ${minParasPerPage} — paragraphs are still merged`,
    )
  }
  if (stats.p90 > P90_MAX_CHARS) {
    errors.push(`${abbreviation}: p90 paragraph length ${stats.p90} > ${P90_MAX_CHARS} chars`)
  }
  if (stats.max > maxParagraphChars) {
    errors.push(`${abbreviation}: max paragraph length ${stats.max} > ${maxParagraphChars} chars`)
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function titlePattern(title: string): string {
  return title
    .replace(/["']/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(escapeRegExp)
    .map((part) => part.replace(/["']/g, `["']?`))
    .join("\\s+")
}

function looksLikePageNumberArtifact(
  text: string,
  bookTitle: string,
  chapterTitle: string,
  printedPage: number,
): boolean {
  const trimmed = text.trim()
  const pageNumber = "\\d{1,4}"
  const leadingNumber = trimmed.match(/^(\d{1,4})\s+/)
  const trailingNumber = trimmed.match(/\s+(\d{1,4})$/)
  const chapterPattern = titlePattern(chapterTitle)
  const bookPattern = titlePattern(bookTitle)
  const titleHeaderPatterns = [chapterPattern, bookPattern]
    .filter(Boolean)
    .map((pattern) => new RegExp(`\\b${pattern}\\s+${pageNumber}\\b`, "i"))

  return (
    (leadingNumber != null && Number(leadingNumber[1]) === printedPage) ||
    (trailingNumber != null && Number(trailingNumber[1]) === printedPage) ||
    titleHeaderPatterns.some((pattern) => pattern.test(trimmed))
  )
}

function main() {
  const qualityErrors: string[] = []
  const statsTable: Record<string, ParagraphStats> = {}
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

    const pageParagraphs = new Set<string>()
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
        if (!Number.isInteger(paragraph.page) || paragraph.page <= 0) {
          throw new Error(
            `${book.abbreviation} ${chapter.chapter}:${paragraph.paragraph} is missing a printed page`,
          )
        }
        if (
          !Number.isInteger(paragraph.page_paragraph) ||
          paragraph.page_paragraph <= 0
        ) {
          throw new Error(
            `${book.abbreviation} ${chapter.chapter}:${paragraph.paragraph} is missing a printed page paragraph`,
          )
        }
        const pageParagraphKey = `${paragraph.page}:${paragraph.page_paragraph}`
        if (pageParagraphs.has(pageParagraphKey)) {
          throw new Error(
            `${book.abbreviation} p.${paragraph.page} par.${paragraph.page_paragraph} is duplicated`,
          )
        }
        pageParagraphs.add(pageParagraphKey)
        if (!paragraph.text.trim()) {
          throw new Error(
            `${book.abbreviation} ${chapter.chapter}:${paragraph.paragraph} is empty`,
          )
        }
        if (
          looksLikePageNumberArtifact(
            paragraph.text,
            source.title,
            chapter.title,
            paragraph.page,
          )
        ) {
          throw new Error(
            `${book.abbreviation} ${chapter.chapter}:${paragraph.paragraph} appears to contain a PDF page number artifact`,
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

    const stats = paragraphStats(source)
    statsTable[book.abbreviation] = stats
    assertParagraphQuality(
      book.abbreviation,
      stats,
      book.minParasPerPage,
      book.maxParagraphChars ?? HARD_MAX_CHARS,
      qualityErrors,
    )

    console.log(`${book.abbreviation}=${source.chapters.length}`)
  }

  console.table(statsTable)

  if (qualityErrors.length > 0) {
    throw new Error(
      `Paragraph-quality gates failed:\n${qualityErrors.map((e) => `  - ${e}`).join("\n")}`,
    )
  }
}

main()
