export interface EgwParagraphSource {
  paragraph: number
  page?: number
  page_paragraph?: number
  continued_pages?: number[]
  text: string
}

export interface CleanEgwParagraphsOptions {
  bookTitle: string
  chapterTitle: string
}

interface CleanedParagraph {
  page?: number
  continued_pages?: number[]
  text: string
  hadPageArtifact: boolean
}

const MIN_READABLE_PARAGRAPH_CHARS = 420
const MAX_READABLE_PARAGRAPH_CHARS = 850
// A paragraph longer than this is split at sentence boundaries even when no page
// artifact was detected. Page-spanning paragraphs are normally split for
// readability once their page-transition header is recognized, but even-page
// running headers ("<page> <BookTitle>") merge inline and evade that detection,
// leaving a few genuinely over-long paragraphs. This is the backstop for them.
const OVERLONG_PARAGRAPH_CHARS = 2000

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeTypography(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u00ad/g, "")
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
}

function stripPageArtifacts(
  text: string,
  { bookTitle, chapterTitle }: CleanEgwParagraphsOptions,
): CleanedParagraph {
  let next = normalizeTypography(text).trim()
  let hadPageArtifact = false

  const pageNumber = "\\d{1,4}"
  const normalizedChapterTitle = chapterTitle.replace(/["']/g, "").trim()
  const chapterTitleVariants = Array.from(
    new Set(
      [chapterTitle, normalizedChapterTitle]
        .map((title) => title.trim())
        .flatMap((title) => [
          title,
          title.replace(/^(?:the|a|an)\s+/i, "").trim(),
        ])
        .filter(Boolean),
    ),
  )
  const titleWordPatterns = chapterTitleVariants.map((title) =>
    title
      .split(/\s+/)
      .filter(Boolean)
      .map(escapeRegExp)
      .join("\\s+"),
  )
  const titlePatterns = [
    ...titleWordPatterns.map(
      (pattern) => new RegExp(`^${pattern}\\s+${pageNumber}\\s+`, "i"),
    ),
    new RegExp(`^${escapeRegExp(bookTitle)}\\s+${pageNumber}\\s+`, "i"),
  ]

  for (const pattern of titlePatterns) {
    if (pattern.test(next)) {
      next = next.replace(pattern, "")
      hadPageArtifact = true
    }
  }

  for (const titleWordPattern of titleWordPatterns) {
    const inlineTitleHeader = new RegExp(
      `\\s+${titleWordPattern}\\s+${pageNumber}\\s+`,
      "i",
    )
    if (inlineTitleHeader.test(next)) {
      next = next.replace(inlineTitleHeader, " ")
      hadPageArtifact = true
    }
  }

  if (/^\d{2,4}\s+/.test(next)) {
    next = next.replace(/^\d{2,4}\s+/, "")
    hadPageArtifact = true
  }

  if (/\s+\d{1,4}$/.test(next)) {
    next = next.replace(/\s+\d{1,4}$/, "")
    hadPageArtifact = true
  }

  return {
    text: next
      .replace(/[ \t]+\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
    hadPageArtifact,
  }
}

function startsAsContinuation(text: string): boolean {
  return /^[a-z]/.test(text) || /^(?:and|or|but|for|nor|so|yet)\b/i.test(text)
}

function hasTerminalPunctuation(text: string): boolean {
  return /[.!?]["')\]]?$/.test(text.trim())
}

function shouldMergeParagraphs(
  previous: CleanedParagraph,
  next: CleanedParagraph,
): boolean {
  // A sentence mis-split mid-flow: the previous fragment has no closing
  // punctuation and the next resumes it in lower case or with a conjunction.
  // This is the reliable continuation signal and holds whether the break fell
  // across a printed page or within one, so it is checked before the older
  // page-artifact heuristics (which refused to merge across differing pages and
  // ignored same-page layout splits that carried no page artifact).
  if (!hasTerminalPunctuation(previous.text) && startsAsContinuation(next.text)) {
    return true
  }
  if (
    previous.page != null &&
    next.page != null &&
    previous.page !== next.page
  ) {
    return false
  }
  if (!previous.hadPageArtifact && !next.hadPageArtifact) return false
  if (!hasTerminalPunctuation(previous.text)) return true
  return startsAsContinuation(next.text)
}

function joinFragments(left: string, right: string): string {
  if (!left) return right.trim()
  if (!right) return left.trim()

  const joined = /[-/]$/.test(left)
    ? `${left}${right}`
    : `${left} ${right}`

  return joined
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function mergedContinuedPages(
  previous: CleanedParagraph,
  next: CleanedParagraph,
): number[] | undefined {
  const pages: number[] = []
  const addPage = (page: number | undefined) => {
    if (page != null && !pages.includes(page)) pages.push(page)
  }

  for (const page of previous.continued_pages ?? []) addPage(page)
  if (
    previous.page != null &&
    next.page != null &&
    previous.page !== next.page
  ) {
    addPage(next.page)
  }
  for (const page of next.continued_pages ?? []) addPage(page)

  return pages.length > 0 ? pages : undefined
}

function splitOversizedSentence(sentence: string): string[] {
  if (sentence.length <= MAX_READABLE_PARAGRAPH_CHARS) return [sentence]

  const chunks: string[] = []
  const words = sentence.split(/\s+/)
  let current = ""

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (
      current.length >= MIN_READABLE_PARAGRAPH_CHARS &&
      next.length > MAX_READABLE_PARAGRAPH_CHARS
    ) {
      chunks.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) chunks.push(current)
  return chunks
}

function splitIntoSentences(text: string): string[] {
  return (
    text.match(/[^.!?]+[.!?]["')\]]*|[^.!?]+$/g)?.map((sentence) =>
      sentence.trim(),
    ) ?? [text.trim()]
  ).filter(Boolean)
}

function splitReadableParagraph(text: string): string[] {
  if (text.length <= MAX_READABLE_PARAGRAPH_CHARS) return [text]

  const sentences = splitIntoSentences(text).flatMap(splitOversizedSentence)
  const paragraphs: string[] = []
  let current = ""

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence
    if (
      current.length >= MIN_READABLE_PARAGRAPH_CHARS &&
      next.length > MAX_READABLE_PARAGRAPH_CHARS
    ) {
      paragraphs.push(current)
      current = sentence
    } else {
      current = next
    }
  }

  if (current) paragraphs.push(current)
  return paragraphs
}

function mergeReadableContinuations(
  paragraphs: CleanedParagraph[],
): CleanedParagraph[] {
  const merged: CleanedParagraph[] = []

  for (const paragraph of paragraphs) {
    const previous = merged.at(-1)
    if (
      previous &&
      startsAsContinuation(paragraph.text) &&
      (previous.hadPageArtifact || paragraph.hadPageArtifact) &&
      (previous.page == null ||
        paragraph.page == null ||
        previous.page === paragraph.page)
    ) {
      previous.text = joinFragments(previous.text, paragraph.text)
      previous.page = previous.page ?? paragraph.page
      previous.continued_pages = mergedContinuedPages(previous, paragraph)
      previous.hadPageArtifact =
        previous.hadPageArtifact || paragraph.hadPageArtifact
      continue
    }
    merged.push(paragraph)
  }

  return merged
}

export function cleanEgwParagraphs(
  paragraphs: EgwParagraphSource[],
  options: CleanEgwParagraphsOptions,
): EgwParagraphSource[] {
  const cleaned = paragraphs
    .map((paragraph) => ({
      ...stripPageArtifacts(paragraph.text, options),
      page: paragraph.page,
      continued_pages: paragraph.continued_pages,
    }))
    .filter((paragraph) => paragraph.text.length > 0)

  const merged: CleanedParagraph[] = []

  for (const paragraph of cleaned) {
    const previous = merged.at(-1)
    if (previous && shouldMergeParagraphs(previous, paragraph)) {
      previous.text = joinFragments(previous.text, paragraph.text)
      previous.page = previous.page ?? paragraph.page
      previous.continued_pages = mergedContinuedPages(previous, paragraph)
      previous.hadPageArtifact =
        previous.hadPageArtifact || paragraph.hadPageArtifact
      continue
    }
    merged.push({ ...paragraph })
  }

  const healed = merged.map((paragraph) => {
    const cleanedAgain = stripPageArtifacts(paragraph.text, options)
    return {
      page: paragraph.page,
      continued_pages: paragraph.continued_pages,
      text: cleanedAgain.text,
      hadPageArtifact: paragraph.hadPageArtifact || cleanedAgain.hadPageArtifact,
    }
  })

  const readable = mergeReadableContinuations(
    healed.flatMap((paragraph) =>
      paragraph.hadPageArtifact ||
      paragraph.text.length > OVERLONG_PARAGRAPH_CHARS
        ? splitReadableParagraph(paragraph.text).map((text, index, pieces) => ({
            page: paragraph.page,
            continued_pages:
              index === pieces.length - 1 ? paragraph.continued_pages : undefined,
            text,
            hadPageArtifact: true,
          }))
        : [paragraph],
    ),
  )

  return readable.map((paragraph, index) => ({
    paragraph: index + 1,
    page: paragraph.page,
    continued_pages: paragraph.continued_pages,
    text: paragraph.text,
  }))
}
