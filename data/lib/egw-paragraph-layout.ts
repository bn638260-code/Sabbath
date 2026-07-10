export interface PdfTextItemLike {
  str: string
  /** pdf.js text matrix: [a, b, c, d, x, y] */
  transform: number[]
  width: number
  height: number
}

export interface ParagraphLayoutOptions {
  /** Max y-difference (PDF units) for items on the same line. */
  yTolerance?: number
  /** First-line indent threshold in em (multiples of modal font height). */
  indentEm?: number
  /** A vertical gap larger than gapFactor × modal line gap starts a paragraph. */
  gapFactor?: number
  /**
   * Lines whose font height is at least this multiple of the modal body height
   * are treated as heading/title lines: they never start a new paragraph, so a
   * chapter title that wraps onto a second (often centered) line stays in one
   * chunk instead of being split — which would otherwise break anchor matching.
   * Undefined disables the check (default), preserving prior behavior.
   */
  headingHeightRatio?: number
}

export interface PageParagraphText {
  text: string
  continuesFromPreviousPage: boolean
}

const DEFAULTS: Required<Omit<ParagraphLayoutOptions, "headingHeightRatio">> = {
  yTolerance: 2.5,
  indentEm: 0.9,
  gapFactor: 1.7,
}

interface Line {
  parts: Array<{ str: string; x: number }>
  x: number
  y: number
  height: number
}

function isStandaloneNumberLine(text: string): boolean {
  return /^\[?[ivxlcdm\d]{1,8}\]?$/i.test(text.trim())
}

/** A bracketed printed-page marker such as "[287]" that pdf.js emits as its
 * own token, typically in the far-left margin. */
function isPageMarkerToken(text: string): boolean {
  return /^\[[ivxlcdm\d]{1,8}\]$/i.test(text.trim())
}

/**
 * Left edge of a line's *body* text, ignoring a leading page-marker token that
 * sits in the margin. Without this, an inline "[287]" printed on the first line
 * of a new paragraph drags the line's x into the margin and hides the first-line
 * indent, silently merging that paragraph into the previous one.
 */
function lineLeftX(line: Line): number {
  for (const part of line.parts) {
    if (!isPageMarkerToken(part.str)) return part.x
  }
  return line.x
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** Most frequent value after rounding — used for the body column's left edge. */
function modal(values: number[]): number {
  const counts = new Map<number, number>()
  for (const value of values) {
    const key = Math.round(value)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  let best = 0
  let bestCount = -1
  for (const [key, count] of counts) {
    if (count > bestCount || (count === bestCount && key < best)) {
      best = key
      bestCount = count
    }
  }
  return best
}

function estimateBodyHeight(
  lines: Line[],
  headingHeightRatio: number | undefined,
): number {
  const heights = lines.map((line) => line.height).filter((height) => height > 0)
  if (heights.length === 0) return 10
  if (headingHeightRatio == null) return median(heights) || 10

  const sorted = [...heights].sort((a, b) => a - b)
  const lowerHalf = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)))
  return median(lowerHalf) || 10
}

function isHeadingLayoutLine(
  line: Line,
  headingHeightRatio: number | undefined,
  bodyHeight: number,
): boolean {
  return headingHeightRatio != null && line.height >= headingHeightRatio * bodyHeight
}

function measureParagraphStats(
  lines: Line[],
  indentEm: number,
  headingHeightRatio: number | undefined,
): { baseX: number; em: number; indentThreshold: number; modalGap: number } {
  const textLines = lines.filter((line) => !isStandaloneNumberLine(lineText(line)))
  const initialStatsLines = textLines.length > 0 ? textLines : lines
  const em = estimateBodyHeight(initialStatsLines, headingHeightRatio)
  const nonHeadingStatsLines = initialStatsLines.filter(
    (line) => !isHeadingLayoutLine(line, headingHeightRatio, em),
  )
  const statsLines =
    nonHeadingStatsLines.length > 0 ? nonHeadingStatsLines : initialStatsLines
  const gaps: number[] = []
  for (let i = 1; i < initialStatsLines.length; i += 1) {
    const gap = initialStatsLines[i - 1].y - initialStatsLines[i].y
    if (gap > 0) gaps.push(gap)
  }

  return {
    baseX: modal(statsLines.map((line) => lineLeftX(line))),
    em,
    indentThreshold: indentEm * em,
    modalGap: median(gaps) || em * 1.2,
  }
}

function buildLines(items: PdfTextItemLike[], yTolerance: number): Line[] {
  const positioned = items
    .filter((item) => item.str.trim().length > 0)
    .map((item) => ({
      str: item.str,
      x: item.transform[4] ?? 0,
      y: item.transform[5] ?? 0,
      height: item.height || Math.abs(item.transform[3] ?? 0) || 10,
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const lines: Line[] = []
  for (const item of positioned) {
    const line = lines[lines.length - 1]
    if (line && Math.abs(line.y - item.y) <= yTolerance) {
      line.parts.push({ str: item.str, x: item.x })
      line.x = Math.min(line.x, item.x)
    } else {
      lines.push({
        parts: [{ str: item.str, x: item.x }],
        x: item.x,
        y: item.y,
        height: item.height,
      })
    }
  }
  for (const line of lines) {
    line.parts.sort((a, b) => a.x - b.x)
  }
  return lines
}

function lineText(line: Line): string {
  return line.parts
    .map((part) => part.str)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export function reconstructPageParagraphs(
  items: PdfTextItemLike[],
  options: ParagraphLayoutOptions = {},
): PageParagraphText {
  const { yTolerance, indentEm, gapFactor } = { ...DEFAULTS, ...options }
  const { headingHeightRatio } = options
  const lines = buildLines(items, yTolerance)
  if (lines.length === 0) return { text: "", continuesFromPreviousPage: false }

  const { baseX, em, indentThreshold, modalGap } = measureParagraphStats(
    lines,
    indentEm,
    headingHeightRatio,
  )

  const chunks: string[][] = []
  let current: string[] = []
  let previousBodyY: number | null = null
  let firstBodyLineSeen = false
  let firstBodyLineIndented = false

  for (const line of lines) {
    const text = lineText(line)
    if (!text) continue

    if (isStandaloneNumberLine(text)) {
      // Folio / printed page number: own chunk so downstream page-marker
      // handling sees it as a standalone line; never a paragraph signal.
      if (current.length > 0) chunks.push(current)
      chunks.push([text])
      current = []
      continue
    }

    // A heading/title line (font notably taller than the body) is never a
    // paragraph start; keeping it with the preceding line holds wrapped,
    // often-centered chapter titles together for anchor matching.
    const isHeadingLine = isHeadingLayoutLine(line, headingHeightRatio, em)
    const indented = !isHeadingLine && lineLeftX(line) - baseX >= indentThreshold
    const gapBreak =
      !isHeadingLine &&
      previousBodyY !== null &&
      previousBodyY - line.y >= gapFactor * modalGap

    if (!firstBodyLineSeen) {
      firstBodyLineSeen = true
      // Heading-first pages start new sections, not previous-page continuations.
      firstBodyLineIndented = indented || isHeadingLine
    } else if (indented || gapBreak) {
      if (current.length > 0) chunks.push(current)
      current = []
    }

    current.push(text)
    if (!isHeadingLine) {
      previousBodyY = line.y
    }
  }
  if (current.length > 0) chunks.push(current)

  return {
    text: chunks.map((chunk) => chunk.join("\n")).join("\n\n"),
    continuesFromPreviousPage: firstBodyLineSeen && !firstBodyLineIndented,
  }
}
