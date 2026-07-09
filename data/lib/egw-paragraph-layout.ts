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
}

export interface PageParagraphText {
  text: string
  continuesFromPreviousPage: boolean
}

const DEFAULTS: Required<ParagraphLayoutOptions> = {
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
  const lines = buildLines(items, yTolerance)
  if (lines.length === 0) return { text: "", continuesFromPreviousPage: false }

  const bodyLines = lines.filter((line) => !isStandaloneNumberLine(lineText(line)))
  const statsLines = bodyLines.length > 0 ? bodyLines : lines
  const baseX = modal(statsLines.map((line) => line.x))
  const em = median(statsLines.map((line) => line.height)) || 10
  const indentThreshold = indentEm * em
  const gaps: number[] = []
  for (let i = 1; i < statsLines.length; i += 1) {
    const gap = statsLines[i - 1].y - statsLines[i].y
    if (gap > 0) gaps.push(gap)
  }
  const modalGap = median(gaps) || em * 1.2

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

    const indented = line.x - baseX >= indentThreshold
    const gapBreak =
      previousBodyY !== null && previousBodyY - line.y >= gapFactor * modalGap

    if (!firstBodyLineSeen) {
      firstBodyLineSeen = true
      firstBodyLineIndented = indented
    } else if (indented || gapBreak) {
      if (current.length > 0) chunks.push(current)
      current = []
    }

    current.push(text)
    previousBodyY = line.y
  }
  if (current.length > 0) chunks.push(current)

  return {
    text: chunks.map((chunk) => chunk.join("\n")).join("\n\n"),
    continuesFromPreviousPage: firstBodyLineSeen && !firstBodyLineIndented,
  }
}
