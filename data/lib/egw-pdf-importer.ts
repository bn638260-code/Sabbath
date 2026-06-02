import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

export interface EgwChapterConfig {
  chapter: number
  title: string
}

export interface EgwBookConfig {
  title: string
  abbreviation: string
  book_number: number
  chapterAnchorTemplate: string
  expectedChapterCount: number
  pdfPath: string
  outputJsonPath: string
  debugSlug: string
  requiredTokens: string[]
  appendixMarker?: string
  chapters: EgwChapterConfig[]
}

type OutputChapter = {
  chapter: number
  title: string
  paragraphs: Array<{ paragraph: number; text: string }>
}

function repoRoot(): string {
  return import.meta.dir === join(process.cwd(), "data", "lib")
    ? process.cwd()
    : dirname(dirname(import.meta.dir))
}

function normalizePageText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\u00ad/g, "")
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/-\n([a-z])/g, "$1")
    .replace(/\[\d+\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
}

function normalizeFullText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00ad/g, "")
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/-\n([a-z])/g, "$1")
    .replace(/\[\d+\]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/(?<!\n)\n(?!\n)/g, " ")
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
    .map((paragraph) => cleanParagraph(paragraph))
    .filter((paragraph) => paragraph.length > 0)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function stripChapterFurniture(
  raw: string,
  bookTitle: string,
  currentTitle: string,
): string {
  const escBook = escapeRegExp(bookTitle)
  const escTitle = escapeRegExp(currentTitle)
  return raw
    .replace(new RegExp(`\\b${escBook}\\b`, "gi"), "")
    .replace(new RegExp(`${escTitle}\\s+\\d+`, "gi"), "")
    .replace(new RegExp(escTitle, "gi"), "")
    .replace(/^\s*\d+\s*$/gm, "")
    .replace(/^\s*Contents\s*$/gim, "")
    .replace(/^\s*Appendix\s*$/gim, "")
    .replace(/^\s*Foreword\s*$/gim, "")
    .replace(/^\s*Preface\s*$/gim, "")
    .trim()
}

function chapterAnchor(template: string, chapter: number, title: string): string {
  return template
    .replaceAll("{chapter}", String(chapter))
    .replaceAll("{title}", title)
}

function ensureUsableText(fullText: string, requiredTokens: readonly string[]): void {
  for (const token of requiredTokens) {
    if (!fullText.includes(token)) {
      throw new Error(
        `PDF text layer is not usable for deterministic conversion: missing "${token}".`,
      )
    }
  }
}

async function extractPages(pdfPath: string): Promise<Array<{ page: number; text: string }>> {
  const loadingTask = getDocument(pdfPath)
  const pdf = await loadingTask.promise
  const pages: Array<{ page: number; text: string }> = []

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const items = textContent.items

    let pageText = ""
    for (const item of items) {
      if (!("str" in item)) continue
      pageText += item.str
      if ("hasEOL" in item && item.hasEOL) {
        pageText += "\n"
      } else {
        pageText += " "
      }
    }

    pages.push({
      page: i,
      text: normalizePageText(pageText),
    })
  }

  return pages
}

export async function importEgwPdf(config: EgwBookConfig): Promise<void> {
  if (!existsSync(config.pdfPath)) {
    throw new Error(`Source PDF not found: ${config.pdfPath}`)
  }

  const root = repoRoot()
  const debugDir = join(root, "tmp", "egw", config.debugSlug)
  const debugPagesJson = join(debugDir, "pages.json")
  const debugTextTxt = join(debugDir, "extracted.txt")

  mkdirSync(debugDir, { recursive: true })
  mkdirSync(dirname(config.outputJsonPath), { recursive: true })

  const pages = await extractPages(config.pdfPath)
  writeFileSync(debugPagesJson, `${JSON.stringify(pages, null, 2)}\n`)

  const rawFullText = pages.map((page) => page.text).join("\n\n")
  writeFileSync(debugTextTxt, rawFullText)

  ensureUsableText(rawFullText, config.requiredTokens)
  const normalized = normalizeFullText(rawFullText)

  const chapterPositions: Array<{ chapter: number; title: string; anchor: string; pos: number }> =
    []

  for (const chapter of config.chapters) {
    const anchor = chapterAnchor(
      config.chapterAnchorTemplate,
      chapter.chapter,
      chapter.title,
    )
    const pos = normalized.lastIndexOf(anchor)
    if (pos === -1) {
      throw new Error(`Missing chapter anchor: ${anchor}`)
    }
    chapterPositions.push({
      chapter: chapter.chapter,
      title: chapter.title,
      anchor,
      pos,
    })
  }

  for (let i = 1; i < chapterPositions.length; i += 1) {
    if (chapterPositions[i].pos <= chapterPositions[i - 1].pos) {
      throw new Error(
        `Chapter order broken: ${chapterPositions[i].anchor} comes before ${chapterPositions[i - 1].anchor}`,
      )
    }
  }

  const lastChapter = chapterPositions[chapterPositions.length - 1]
  const searchStart = lastChapter.pos + lastChapter.anchor.length
  const appendixIdx = config.appendixMarker
    ? normalized.indexOf(config.appendixMarker, searchStart)
    : -1

  const mainText =
    appendixIdx !== -1 ? normalized.slice(0, appendixIdx) : normalized

  const chapters: OutputChapter[] = []

  for (let i = 0; i < chapterPositions.length; i += 1) {
    const current = chapterPositions[i]
    const next = i + 1 < chapterPositions.length ? chapterPositions[i + 1] : null

    const start = current.pos + current.anchor.length
    const end = next ? next.pos : mainText.length
    if (end <= start) {
      throw new Error(`Invalid text range for chapter ${current.chapter}`)
    }

    const rawSlice = mainText.slice(start, end)
    const cleaned = stripChapterFurniture(rawSlice, config.title, current.title)
    const paragraphTexts = splitParagraphs(cleaned)

    if (paragraphTexts.length === 0) {
      throw new Error(`No paragraphs extracted for chapter ${current.chapter}`)
    }

    for (let paragraphIndex = 0; paragraphIndex < paragraphTexts.length; paragraphIndex += 1) {
      if (!paragraphTexts[paragraphIndex]) {
        throw new Error(
          `Empty paragraph extracted in chapter ${current.chapter} at ${paragraphIndex + 1}`,
        )
      }
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

  if (chapters.length !== config.expectedChapterCount) {
    throw new Error(
      `Expected ${config.expectedChapterCount} chapters, got ${chapters.length}`,
    )
  }

  for (let i = 0; i < chapters.length; i += 1) {
    const chapter = chapters[i]
    if (chapter.chapter !== i + 1) {
      throw new Error(`Chapter sequence broken at ${i + 1}`)
    }
    for (let j = 0; j < chapter.paragraphs.length; j += 1) {
      if (chapter.paragraphs[j].paragraph !== j + 1) {
        throw new Error(
          `Paragraph sequence broken in chapter ${chapter.chapter} at ${j + 1}`,
        )
      }
    }
  }

  const output = {
    title: config.title,
    abbreviation: config.abbreviation,
    book_number: config.book_number,
    chapters,
  }

  writeFileSync(config.outputJsonPath, `${JSON.stringify(output, null, 2)}\n`)

  const totalParagraphs = chapters.reduce(
    (sum, chapter) => sum + chapter.paragraphs.length,
    0,
  )
  console.log(
    `Imported ${config.title}: ${chapters.length} chapters, ${totalParagraphs} paragraphs.`,
  )
  console.log(`Wrote JSON to ${config.outputJsonPath}`)
}
