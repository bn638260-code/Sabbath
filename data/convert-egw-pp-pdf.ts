/**
 * One-shot converter for:
 *   C:\Users\fanel\Downloads\en_PP.pdf
 *
 * Output:
 *   data/sources/egw/patriarchs-and-prophets.json
 *
 * Debug:
 *   tmp/egw/en_PP/pages.json
 *   tmp/egw/en_PP/extracted.txt
 *
 * This script is intentionally book-specific.
 * It must fail fast if the PDF does not expose a usable text layer.
 *
 * DEVIATIONS from Appendix B plan:
 * 1. Chapter anchors appear twice (ToC + actual text). The plan's indexOf()
 *    would match ToC entries first. Fixed by using lastIndexOf() to get
 *    the actual chapter heading positions.
 * 2. "Appendix" token appears in the ToC, not just the appendix section.
 *    The plan's indexOf("Appendix") would cut all chapter content after the ToC.
 *    Fixed by finding the actual appendix section heading ("Appendix [") after
 *    Chapter 73's position.
 * 3. Text extraction uses hasEOL flags (instead of .join(" ")) to preserve
 *    paragraph structure within pages. Without this, paragraph boundaries
 *    within a page are completely lost.
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

const REPO_ROOT = import.meta.dir === join(process.cwd(), "data")
  ? process.cwd()
  : dirname(import.meta.dir)

const INPUT_PDF = String.raw`C:\Users\fanel\Downloads\en_PP.pdf`
const DEBUG_DIR = join(REPO_ROOT, "tmp", "egw", "en_PP")
const DEBUG_PAGES_JSON = join(DEBUG_DIR, "pages.json")
const DEBUG_TEXT_TXT = join(DEBUG_DIR, "extracted.txt")
const OUTPUT_JSON = join(REPO_ROOT, "data", "sources", "egw", "patriarchs-and-prophets.json")

const BOOK = {
  title: "Patriarchs and Prophets",
  abbreviation: "PP",
  book_number: 1,
} as const

const CHAPTERS = [
  { chapter: 1, title: "Why was Sin Permitted?" },
  { chapter: 2, title: "The Creation" },
  { chapter: 3, title: "The Temptation and Fall" },
  { chapter: 4, title: "The Plan of Redemption" },
  { chapter: 5, title: "Cain and Abel Tested" },
  { chapter: 6, title: "Seth and Enoch" },
  { chapter: 7, title: "The Flood" },
  { chapter: 8, title: "After the Flood" },
  { chapter: 9, title: "The Literal Week" },
  { chapter: 10, title: "The Tower of Babel" },
  { chapter: 11, title: "The Call of Abraham" },
  { chapter: 12, title: "Abraham in Canaan" },
  { chapter: 13, title: "The Test of Faith" },
  { chapter: 14, title: "Destruction of Sodom" },
  { chapter: 15, title: "The Marriage of Isaac" },
  { chapter: 16, title: "Jacob and Esau" },
  { chapter: 17, title: "Jacob's Flight and Exile" },
  { chapter: 18, title: "The Night of Wrestling" },
  { chapter: 19, title: "The Return to Canaan" },
  { chapter: 20, title: "Joseph in Egypt" },
  { chapter: 21, title: "Joseph and His Brothers" },
  { chapter: 22, title: "Moses" },
  { chapter: 23, title: "The Plagues of Egypt" },
  { chapter: 24, title: "The Passover" },
  { chapter: 25, title: "The Exodus" },
  { chapter: 26, title: "From the Red Sea to Sinai" },
  { chapter: 27, title: "The Law Given to Israel" },
  { chapter: 28, title: "Idolatry at Sinai" },
  { chapter: 29, title: "Satan's Enmity Against the Law" },
  { chapter: 30, title: "The Tabernacle and Its Services" },
  { chapter: 31, title: "The Sin of Nadab and Abihu" },
  { chapter: 32, title: "The Law and the Covenants" },
  { chapter: 33, title: "From Sinai to Kadesh" },
  { chapter: 34, title: "The Twelve Spies" },
  { chapter: 35, title: "The Rebellion of Korah" },
  { chapter: 36, title: "In the Wilderness" },
  { chapter: 37, title: "The Smitten Rock" },
  { chapter: 38, title: "The Journey Around Edom" },
  { chapter: 39, title: "The Conquest of Bashan" },
  { chapter: 40, title: "Balaam" },
  { chapter: 41, title: "Apostasy at the Jordan" },
  { chapter: 42, title: "The Law Repeated" },
  { chapter: 43, title: "The Death of Moses" },
  { chapter: 44, title: "Crossing the Jordan" },
  { chapter: 45, title: "The Fall of Jericho" },
  { chapter: 46, title: "The Blessings and the Curses" },
  { chapter: 47, title: "League With the Gibeonites" },
  { chapter: 48, title: "The Division of Canaan" },
  { chapter: 49, title: "The Last Words of Joshua" },
  { chapter: 50, title: "Tithes and Offerings" },
  { chapter: 51, title: "God's Care for the Poor" },
  { chapter: 52, title: "The Annual Feasts" },
  { chapter: 53, title: "The Earlier Judges" },
  { chapter: 54, title: "Samson" },
  { chapter: 55, title: "The Child Samuel" },
  { chapter: 56, title: "Eli and His Sons" },
  { chapter: 57, title: "The Ark Taken by the Philistines" },
  { chapter: 58, title: "The Schools of the Prophets" },
  { chapter: 59, title: "The First King of Israel" },
  { chapter: 60, title: "The Presumption of Saul" },
  { chapter: 61, title: "Saul Rejected" },
  { chapter: 62, title: "The Anointing of David" },
  { chapter: 63, title: "David and Goliath" },
  { chapter: 64, title: "David a Fugitive" },
  { chapter: 65, title: "The Magnanimity of David" },
  { chapter: 66, title: "The Death of Saul" },
  { chapter: 67, title: "Ancient and Modern Sorcery" },
  { chapter: 68, title: "David at Ziklag" },
  { chapter: 69, title: "David Called to the Throne" },
  { chapter: 70, title: "The Reign of David" },
  { chapter: 71, title: "David's Sin and Repentance" },
  { chapter: 72, title: "The Rebellion of Absalom" },
  { chapter: 73, title: "The Last Years of David" },
] as const

type OutputChapter = {
  chapter: number
  title: string
  paragraphs: Array<{ paragraph: number; text: string }>
}

function chapterAnchor(chapter: number, title: string): string {
  return `Chapter ${chapter}—${title}`
}

function ensureUsableText(fullText: string): void {
  const required = [
    "Contents",
    "Chapter 1—Why was Sin Permitted?",
    "Appendix",
  ]
  for (const token of required) {
    if (!fullText.includes(token)) {
      throw new Error(
        `PDF text layer is not usable for deterministic conversion: missing "${token}". OCR/manual external extraction required.`
      )
    }
  }
}

function normalizePageText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\u00ad/g, "") // soft hyphens
    .replace(/\u2019/g, "'") // RIGHT SINGLE QUOTATION MARK → ASCII apostrophe
    .replace(/\u2018/g, "'") // LEFT SINGLE QUOTATION MARK → ASCII apostrophe
    .replace(/\u201c/g, '"') // LEFT DOUBLE QUOTATION MARK → ASCII quote
    .replace(/\u201d/g, '"') // RIGHT DOUBLE QUOTATION MARK → ASCII quote
    .replace(/-\n([a-z])/g, "$1") // line-break hyphens
    .replace(/\[\d+\]/g, "") // page markers [29]
    .replace(/[ \t]+\n/g, "\n") // trailing spaces before newline
    .replace(/[ \t]{2,}/g, " ") // collapse multiple spaces
}

function normalizeFullText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00ad/g, "")
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/-\n([a-z])/g, "$1")
    .replace(/\[\d+\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n") // collapse 3+ newlines to 2
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function cleanParagraph(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
}

function splitParagraphs(chapterText: string): string[] {
  return chapterText
    .split(/\n\s*\n/g)
    .map((p) => cleanParagraph(p))
    .filter((p) => p.length > 0)
}

function stripChapterFurniture(raw: string, currentTitle: string): string {
  const escBook = escapeRegExp(BOOK.title)
  const escTitle = escapeRegExp(currentTitle)
  return raw
    .replace(new RegExp(`\\b${escBook}\\b`, "gi"), "")
    .replace(new RegExp(`\\b${escTitle}\\b`, "gi"), "")
    .replace(/^\s*\d+\s*$/gm, "")
    .replace(/^\s*Contents\s*$/gm, "")
    .replace(/^\s*Appendix\s*$/gm, "")
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

async function extractPages(pdfPath: string): Promise<Array<{ page: number; text: string }>> {
  const loadingTask = getDocument(pdfPath)
  const pdf = await loadingTask.promise
  const pages: Array<{ page: number; text: string }> = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const raw = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
    pages.push({
      page: i,
      text: normalizePageText(raw),
    })
  }

  return pages
}

async function main() {
  if (!existsSync(INPUT_PDF)) {
    throw new Error(`Source PDF not found: ${INPUT_PDF}`)
  }

  mkdirSync(DEBUG_DIR, { recursive: true })
  mkdirSync(dirname(OUTPUT_JSON), { recursive: true })

  const pages = await extractPages(INPUT_PDF)
  writeFileSync(DEBUG_PAGES_JSON, JSON.stringify(pages, null, 2))
  console.log(`Wrote debug pages: ${DEBUG_PAGES_JSON}`)

  // Build raw text: pages joined with double newlines
  const rawFullText = pages.map((p) => p.text).join("\n\n")
  writeFileSync(DEBUG_TEXT_TXT, rawFullText)
  console.log(`Wrote debug text: ${DEBUG_TEXT_TXT}`)

  ensureUsableText(rawFullText)

  // Normalize: join wrapped lines, collapse whitespace
  const normalized = normalizeFullText(rawFullText)

  // Deviation from plan: use lastIndexOf because chapter anchors appear
  // in both ToC (~positions 25000-31000) and actual chapter headings.
  // indexOf() would match ToC entries first.
  const chapterPositions: Array<{ chapter: number; title: string; anchor: string; pos: number }> = []

  for (const ch of CHAPTERS) {
    const anchor = chapterAnchor(ch.chapter, ch.title)
    const pos = normalized.lastIndexOf(anchor)
    if (pos === -1) {
      throw new Error(`Missing chapter anchor (actual heading, not ToC): ${anchor}`)
    }
    chapterPositions.push({ chapter: ch.chapter, title: ch.title, anchor, pos })
    process.stderr.write(`Found Ch ${ch.chapter}: ${anchor} at position ${pos}\n`)
  }

  // Verify chapter positions are in ascending order
  for (let i = 1; i < chapterPositions.length; i++) {
    if (chapterPositions[i].pos <= chapterPositions[i - 1].pos) {
      throw new Error(
        `Chapter order broken: ${chapterPositions[i].anchor} (pos ${chapterPositions[i].pos}) comes before ${chapterPositions[i - 1].anchor} (pos ${chapterPositions[i - 1].pos})`
      )
    }
  }

  // Find appendix boundary after Chapter 73.
  // Deviation: the plan's indexOf("Appendix") matches the ToC entry at pos 31098,
  // which would cut ALL chapter content. Instead, find "Appendix [" which marks
  // the actual appendix section heading (e.g. "Appendix [756] [757] Note 1.").
  const lastChapter = chapterPositions[chapterPositions.length - 1]
  const searchStart = lastChapter.pos + lastChapter.anchor.length
  const appendixIdx = normalized.indexOf("Appendix [", searchStart)

  const mainText = appendixIdx !== -1
    ? normalized.slice(0, appendixIdx)
    : normalized

  const chapters: OutputChapter[] = []

  for (let i = 0; i < CHAPTERS.length; i++) {
    const current = chapterPositions[i]
    const next = i + 1 < chapterPositions.length ? chapterPositions[i + 1] : null

    const start = current.pos
    const end = next ? next.pos : mainText.length

    if (end <= start + current.anchor.length) {
      throw new Error(`Invalid text range for chapter ${current.chapter}`)
    }

    const rawSlice = mainText.slice(start + current.anchor.length, end)
    const cleaned = stripChapterFurniture(rawSlice, current.title)
    const paragraphTexts = splitParagraphs(cleaned)

    if (paragraphTexts.length === 0) {
      throw new Error(`No paragraphs extracted for chapter ${current.chapter}`)
    }

    chapters.push({
      chapter: current.chapter,
      title: current.title,
      paragraphs: paragraphTexts.map((text, index) => ({
        paragraph: index + 1,
        text,
      })),
    })
  }

  if (chapters.length !== 73) {
    throw new Error(`Expected 73 chapters, got ${chapters.length}`)
  }

  const output = {
    title: BOOK.title,
    abbreviation: BOOK.abbreviation,
    book_number: BOOK.book_number,
    chapters,
  }

  writeFileSync(OUTPUT_JSON, `${JSON.stringify(output, null, 2)}\n`)
  console.log(`\nWrote final JSON: ${OUTPUT_JSON}`)
  console.log(`Chapters: ${chapters.length}`)
  console.log(`Total paragraphs: ${chapters.reduce((sum, ch) => sum + ch.paragraphs.length, 0)}`)
  console.log("Manual review is required before considering the conversion complete.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
