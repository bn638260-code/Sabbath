import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { cleanEgwParagraphs } from "./egw-text-cleanup"
import { reconstructPageParagraphs, type PdfTextItemLike } from "./egw-paragraph-layout"

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
  chapters: readonly EgwChapterConfig[]
}

type OutputChapter = {
  chapter: number
  title: string
  paragraphs: Array<{
    paragraph: number
    page: number
    page_paragraph: number
    text: string
  }>
}

type DraftChapter = Omit<OutputChapter, "paragraphs"> & {
  paragraphs: Array<{
    paragraph: number
    page?: number
    continued_pages?: number[]
    text: string
  }>
}

const PAGE_MARKER_PATTERN_SOURCE = String.raw`\[([ivxlcdm\d]{1,8})\]`

function pageMarkerPattern(): RegExp {
  return new RegExp(PAGE_MARKER_PATTERN_SOURCE, "gi")
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

function parseNumericPageMarker(value: string): number | null {
  if (!/^\d{1,4}$/.test(value)) return null
  const page = Number(value)
  return Number.isInteger(page) && page > 0 ? page : null
}

function stripPageMarkers(text: string): string {
  return text.replace(pageMarkerPattern(), " ")
}

function hasNumericBracketPageMarker(text: string): boolean {
  const pattern = pageMarkerPattern()
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (parseNumericPageMarker(match[1] ?? "") != null) {
      return true
    }
  }
  return false
}

function standalonePrintedPageLine(lines: string[]): { index: number; page: number } | null {
  const candidates = [0, lines.length - 1]
  for (const index of candidates) {
    const page = parseNumericPageMarker(lines[index]?.trim() ?? "")
    if (page != null) {
      return { index, page }
    }
  }
  return null
}

function preserveStandalonePrintedPageMarker(text: string): string {
  if (hasNumericBracketPageMarker(text)) return text

  const lines = text.split("\n")
  const nonEmpty = lines
    .map((line, index) => ({ index, text: line.trim() }))
    .filter((line) => line.text.length > 0)
  const marker = standalonePrintedPageLine(nonEmpty.map((line) => line.text))
  if (!marker) return text

  const originalIndex = nonEmpty[marker.index]?.index
  if (originalIndex == null) return text

  lines.splice(originalIndex, 1)
  const body = lines.join("\n").trim()
  return body ? `[${marker.page}]\n${body}` : `[${marker.page}]`
}

function splitParagraphsWithPages(
  chapterText: string,
  chapterStartPage?: number,
): Array<{ page?: number; continued_pages?: number[]; text: string }> {
  let currentPage = chapterStartPage
  const paragraphs: Array<{ page?: number; continued_pages?: number[]; text: string }> = []

  for (const rawChunk of chapterText.split(/\n\s*\n/g)) {
    const chunk = rawChunk.trim()
    if (!chunk) continue

    let pageForParagraph = currentPage
    let sawTextBeforeMarker = false
    let lastIndex = 0
    const continuedPages: number[] = []
    const markerPattern = pageMarkerPattern()

    let match: RegExpExecArray | null
    while ((match = markerPattern.exec(chunk)) !== null) {
      const before = chunk.slice(lastIndex, match.index)
      if (before.trim()) {
        sawTextBeforeMarker = true
      }

      const markerPage = parseNumericPageMarker(match[1] ?? "")
      if (markerPage != null) {
        if (!sawTextBeforeMarker) {
          pageForParagraph = markerPage
        } else if (pageForParagraph == null) {
          pageForParagraph = markerPage
        } else if (markerPage !== pageForParagraph) {
          continuedPages.push(markerPage)
        }
        currentPage = markerPage
      }
      lastIndex = match.index + match[0].length
    }

    const text = cleanParagraph(stripPageMarkers(chunk))
    if (text.length > 0) {
      paragraphs.push({
        page: pageForParagraph,
        continued_pages: continuedPages.length > 0 ? continuedPages : undefined,
        text,
      })
    }
  }

  return paragraphs
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
  const normalizedText = normalizeFullText(fullText)
  for (const token of requiredTokens) {
    const normalizedToken = normalizeFullText(token)
    if (!normalizedText.includes(normalizedToken)) {
      throw new Error(
        `PDF text layer is not usable for deterministic conversion: missing "${token}".`,
      )
    }
  }
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

function parseTocPageNumber(tocText: string, chapter: EgwChapterConfig): number | undefined {
  const title = titlePattern(chapter.title)
  const chapterPattern = new RegExp(
    `\\b(?:Chapter|Chap\\.)\\s+${chapter.chapter}\\s*-\\s*["']*${title}["']*\\s*(?:\\.\\s*)+(\\d{1,4})\\b`,
    "i",
  )
  const chapterMatch = tocText.match(chapterPattern)
  if (chapterMatch?.[1]) return Number(chapterMatch[1])

  const titleOnlyPattern = new RegExp(
    `\\b["']*${title}["']*\\s*(?:\\.\\s*)+(\\d{1,4})\\b`,
    "i",
  )
  const titleMatch = tocText.match(titleOnlyPattern)
  return titleMatch?.[1] ? Number(titleMatch[1]) : undefined
}

function nearestPageMarkerBefore(text: string, pos: number): number | undefined {
  const window = text.slice(Math.max(0, pos - 300), pos)
  let page: number | undefined
  const markerPattern = pageMarkerPattern()

  let match: RegExpExecArray | null
  while ((match = markerPattern.exec(window)) !== null) {
    const parsed = parseNumericPageMarker(match[1] ?? "")
    if (parsed != null) {
      page = parsed
    }
  }

  return page
}

function assignPageParagraphNumbers(chapters: DraftChapter[]): OutputChapter[] {
  const countsByPage = new Map<number, number>()

  return chapters.map((chapter) => ({
    ...chapter,
    paragraphs: chapter.paragraphs.map((paragraph) => {
      if (paragraph.page == null) {
        throw new Error(
          `Missing printed page for ${chapter.title} paragraph ${paragraph.paragraph}`,
        )
      }
      const pageParagraph = (countsByPage.get(paragraph.page) ?? 0) + 1
      countsByPage.set(paragraph.page, pageParagraph)
      for (const continuedPage of paragraph.continued_pages ?? []) {
        countsByPage.set(continuedPage, (countsByPage.get(continuedPage) ?? 0) + 1)
      }
      return {
        paragraph: paragraph.paragraph,
        page: paragraph.page,
        page_paragraph: pageParagraph,
        text: paragraph.text,
      }
    }),
  }))
}

async function extractPages(
  pdfPath: string,
): Promise<Array<{ page: number; text: string; continuesFromPreviousPage: boolean }>> {
  const loadingTask = getDocument(pdfPath)
  const pdf = await loadingTask.promise
  const pages: Array<{ page: number; text: string; continuesFromPreviousPage: boolean }> = []

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const items = textContent.items

    const reconstructed = reconstructPageParagraphs(
      items.filter((item): item is typeof item & PdfTextItemLike => "str" in item),
    )
    const text = preserveStandalonePrintedPageMarker(
      normalizePageText(reconstructed.text),
    )

    pages.push({
      page: i,
      text,
      continuesFromPreviousPage: reconstructed.continuesFromPreviousPage,
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

  let rawFullText = ""
  for (const page of pages) {
    if (rawFullText.length === 0) {
      rawFullText = page.text
    } else {
      rawFullText += page.continuesFromPreviousPage ? "\n" : "\n\n"
      rawFullText += page.text
    }
  }
  writeFileSync(debugTextTxt, rawFullText)

  ensureUsableText(rawFullText, config.requiredTokens)
  const normalized = normalizeFullText(rawFullText)

  const chapterPositions: Array<{
    chapter: number
    title: string
    anchor: string
    pos: number
    tocPage?: number
  }> =
    []

  for (const chapter of config.chapters) {
    const anchor = normalizeFullText(
      chapterAnchor(
        config.chapterAnchorTemplate,
        chapter.chapter,
        chapter.title,
      ),
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

  const tocText = normalized.slice(0, chapterPositions[0].pos)
  for (const chapter of chapterPositions) {
    chapter.tocPage =
      parseTocPageNumber(tocText, chapter) ??
      nearestPageMarkerBefore(normalized, chapter.pos)
  }

  const chapters: DraftChapter[] = []

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
    const paragraphTexts = splitParagraphsWithPages(cleaned, current.tocPage)

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
      paragraphs: cleanEgwParagraphs(
        paragraphTexts.map((paragraph, index) => ({
          paragraph: index + 1,
          page: paragraph.page,
          continued_pages: paragraph.continued_pages,
          text: paragraph.text,
        })),
        {
          bookTitle: config.title,
          chapterTitle: current.title,
        },
      ),
    })
  }

  const outputChapters = assignPageParagraphNumbers(chapters)

  if (outputChapters.length !== config.expectedChapterCount) {
    throw new Error(
      `Expected ${config.expectedChapterCount} chapters, got ${outputChapters.length}`,
    )
  }

  for (let i = 0; i < outputChapters.length; i += 1) {
    const chapter = outputChapters[i]
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
    chapters: outputChapters,
  }

  writeFileSync(config.outputJsonPath, `${JSON.stringify(output, null, 2)}\n`)

  const totalParagraphs = outputChapters.reduce(
    (sum, chapter) => sum + chapter.paragraphs.length,
    0,
  )
  console.log(
    `Imported ${config.title}: ${outputChapters.length} chapters, ${totalParagraphs} paragraphs.`,
  )
  console.log(`Wrote JSON to ${config.outputJsonPath}`)
}
