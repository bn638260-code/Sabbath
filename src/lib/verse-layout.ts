import type {
  BroadcastTheme,
  VerseRenderData,
  PresentationRenderData,
  RenderOptions,
  TextVerticalAlign,
} from "@/types"

export interface VerseLayoutRect {
  x: number
  y: number
  width: number
  height: number
}

export interface VerseLayoutMetrics {
  scaledTheme: BroadcastTheme
  textAreaRect: VerseLayoutRect
  textRect: VerseLayoutRect
  referenceRect: VerseLayoutRect | null
  verseRect: VerseLayoutRect | null
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = []
  const paragraphs = text.split(/\n{2,}/)

  for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
    if (paragraphIndex > 0) {
      lines.push("")
    }

    const explicitLines = paragraph.split(/\n/)
    for (const explicitLine of explicitLines) {
      const words = explicitLine.split(/\s+/).filter(Boolean)
      if (words.length === 0) {
        lines.push("")
        continue
      }

      let currentLine = ""
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const metrics = ctx.measureText(testLine)

        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          currentLine = testLine
        }
      }

      if (currentLine) {
        lines.push(currentLine)
      }
    }
  }

  return lines
}

export function alignX(
  textAlign: "left" | "center" | "right",
  rectX: number,
  rectWidth: number
): number {
  switch (textAlign) {
    case "left":
      return rectX
    case "center":
      return rectX + rectWidth / 2
    case "right":
      return rectX + rectWidth
  }
}

export function alignY(
  verticalAlign: "top" | "middle" | "bottom",
  rectY: number,
  rectHeight: number,
  contentHeight: number
): number {
  switch (verticalAlign) {
    case "middle":
      return rectY + (rectHeight - contentHeight) / 2
    case "bottom":
      return rectY + rectHeight - contentHeight
    case "top":
    default:
      return rectY
  }
}

export function resolveHorizontalAlign(
  value:
    | BroadcastTheme["verseText"]["horizontalAlign"]
    | BroadcastTheme["reference"]["horizontalAlign"]
    | undefined,
  fallback: BroadcastTheme["layout"]["textAlign"],
  allowJustify: boolean
): "left" | "center" | "right" | "justify" {
  if (!value) return fallback
  if (value === "justify" && !allowJustify) return fallback
  return value
}

export function resolveVerticalAlign(
  value:
    | BroadcastTheme["verseText"]["verticalAlign"]
    | BroadcastTheme["reference"]["verticalAlign"]
    | undefined
): "top" | "middle" | "bottom" {
  return value ?? "top"
}

export function resolveTextTransform(
  value:
    | BroadcastTheme["verseText"]["textTransform"]
    | BroadcastTheme["reference"]["textTransform"]
    | undefined
): "none" | "uppercase" | "lowercase" | "capitalize" {
  return value ?? "none"
}

export function resolveTextDecoration(
  value:
    | BroadcastTheme["verseText"]["textDecoration"]
    | BroadcastTheme["reference"]["textDecoration"]
    | undefined
): "none" | "underline" | "line-through" {
  return value ?? "none"
}

export function applyTextTransform(
  text: string,
  transform: "none" | "uppercase" | "lowercase" | "capitalize"
): string {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase()
    case "lowercase":
      return text.toLowerCase()
    case "capitalize":
      return text.replace(/\b\w/g, (char) => char.toUpperCase())
    case "none":
    default:
      return text
  }
}

function presentationKind(data: VerseRenderData | PresentationRenderData): PresentationRenderData["kind"] | undefined {
  return "kind" in data ? data.kind : undefined
}

export function lineHeightForPresentation(
  theme: BroadcastTheme,
  data: VerseRenderData | PresentationRenderData,
  fontSize: number
): number {
  const kind = presentationKind(data)
  const lineHeight =
    kind === "hymn"
      ? Math.min(theme.verseText.lineHeight, 1.14)
      : kind === "egw"
        ? Math.min(theme.verseText.lineHeight, 1.32)
        : theme.verseText.lineHeight

  return fontSize * lineHeight
}

export function textForPresentation(
  data: VerseRenderData | PresentationRenderData,
  showVerseNumbers: boolean
): string {
  const kind = presentationKind(data)

  if (kind === "hymn" || kind === "slideDeck") {
    return data.segments.map((segment) => segment.text.trim()).filter(Boolean).join("\n")
  }

  if (kind === "egw") {
    return data.segments.map((segment) => segment.text.trim()).filter(Boolean).join("\n")
  }

  // Scripture flows as one continuous wrapped paragraph (verse numbers
  // inline). Joining readability chunks with blank lines produced uneven
  // blocks with large gaps on the projected slide.
  let fullText = ""
  for (const segment of data.segments) {
    if (showVerseNumbers && segment.verseNumber !== undefined) {
      fullText += `${segment.verseNumber} `
    }
    fullText += `${segment.text} `
  }

  return fullText.trim()
}


function anchorPosition(
  anchor: BroadcastTheme["layout"]["anchor"],
  areaWidth: number,
  areaHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  offsetX: number,
  offsetY: number
): { x: number; y: number } {
  let x: number
  let y: number

  switch (anchor) {
    case "top-left":
      x = 0
      y = 0
      break
    case "top-center":
      x = (canvasWidth - areaWidth) / 2
      y = 0
      break
    case "top-right":
      x = canvasWidth - areaWidth
      y = 0
      break
    case "center":
      x = (canvasWidth - areaWidth) / 2
      y = (canvasHeight - areaHeight) / 2
      break
    case "bottom-left":
      x = 0
      y = canvasHeight - areaHeight
      break
    case "bottom-center":
      x = (canvasWidth - areaWidth) / 2
      y = canvasHeight - areaHeight
      break
    case "bottom-right":
      x = canvasWidth - areaWidth
      y = canvasHeight - areaHeight
      break
  }

  return { x: x + offsetX, y: y + offsetY }
}

export function clampCornerRadius(
  width: number,
  height: number,
  radius: number,
): number {
  return Math.min(Math.max(0, radius), Math.max(0, Math.min(width, height) / 2))
}

function buildScaledTheme(
  theme: BroadcastTheme,
  scale: number
): BroadcastTheme {
  const layout = {
    ...theme.layout,
    offsetX: theme.layout.offsetX * scale,
    offsetY: theme.layout.offsetY * scale,
    padding: {
      top: theme.layout.padding.top * scale,
      right: theme.layout.padding.right * scale,
      bottom: theme.layout.padding.bottom * scale,
      left: theme.layout.padding.left * scale,
    },
  }
  return {
    ...theme,
    layout,
    resolution: {
      width: theme.resolution.width * scale,
      height: theme.resolution.height * scale,
    },
    verseText: {
      ...theme.verseText,
      fontSize: theme.verseText.fontSize * scale,
      letterSpacing: theme.verseText.letterSpacing * scale,
      shadow: theme.verseText.shadow
        ? {
            ...theme.verseText.shadow,
            blur: theme.verseText.shadow.blur * scale,
            x: theme.verseText.shadow.x * scale,
            y: theme.verseText.shadow.y * scale,
          }
        : null,
      outline: theme.verseText.outline
        ? {
            ...theme.verseText.outline,
            width: theme.verseText.outline.width * scale,
          }
        : null,
    },
    verseNumbers: {
      ...theme.verseNumbers,
      fontSize: theme.verseNumbers.fontSize * scale,
    },
    reference: {
      ...theme.reference,
      fontSize: theme.reference.fontSize * scale,
      letterSpacing: theme.reference.letterSpacing * scale,
    },
    textBox: {
      ...theme.textBox,
      borderRadius: theme.textBox.borderRadius * scale,
      padding: theme.textBox.padding * scale,
    },
  }
}

/**
 * Figure out how much vertical space is left for the verse text after accounting for the reference (and its gap).
 *
 * @param theme
 * @param textRect
 * @param referenceHeight
 * @returns
 */
export function calculateMaxAvailableVerseHeight(
  theme: BroadcastTheme,
  textRect: VerseLayoutRect,
  referenceHeight: number
): number {
  const referenceGap = Math.max(
    0,
    // 0.5 x fontSize scales naturally with different themes
    theme.layout.referenceGap ?? theme.reference.fontSize * 0.5
  )

  switch (theme.reference.position) {
    case "above":
      return textRect.height - referenceHeight
    case "below":
      return textRect.height - referenceHeight - referenceGap
    case "inline":
    default:
      return textRect.height
  }
}

/** 
 * Returns the largest verse font size that fits within the available height without overflowing, using binary search.
 * 
 * @param ctx 
 * @param theme 
 * @param verse 
 * @param textRectWidth 
 * @param maxHeight 
 * @returns 
 */
export function calculateScaledFontSize(
  ctx: CanvasRenderingContext2D,
  theme: BroadcastTheme,
  verse: VerseRenderData | PresentationRenderData,
  textRectWidth: number,
  maxHeight: number
): number {
  const originalFontSize = theme.verseText.fontSize
  const minFontSize = Math.max(8, originalFontSize * 0.3) // Don't go below 30% of original or 8px

  // Binary search for optimal font size
  let low = minFontSize
  let high = originalFontSize
  let bestFit = originalFontSize

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)

    // Simulate a temporary theme with the test font size
    const testTheme = {
      ...theme,
      verseText: {
        ...theme.verseText,
        fontSize: mid,
      },
    }

    // If I use this font size, how tall will the verse be?
    const metrics = measureVerseHeight(ctx, testTheme, verse, textRectWidth)

    // Check if the rendered verse is still too big to fit
    if (metrics.height <= maxHeight) {
      // Increase the font size
      bestFit = mid
      low = mid + 1
    } else {
      // Doesn't fit, decrease the font size
      high = mid - 1
    }
  }

  return bestFit
}

function measureVerseHeight(
  ctx: CanvasRenderingContext2D,
  theme: BroadcastTheme,
  verse: VerseRenderData | PresentationRenderData,
  textRectWidth: number
): { height: number; maxLineWidth: number } {
  const vt = theme.verseText
  const vn = theme.verseNumbers
  const verseAlign = resolveHorizontalAlign(
    vt.horizontalAlign,
    theme.layout.textAlign,
    true
  )
  const lineHeightPx = lineHeightForPresentation(theme, verse, vt.fontSize)
  ctx.save()
  const fontStylePrefix = vt.fontStyle === "italic" ? "italic " : ""
  ctx.font = `${fontStylePrefix}${vt.fontWeight} ${vt.fontSize}px "${vt.fontFamily}", serif`
  if (vt.letterSpacing > 0) {
    try {
      ctx.letterSpacing = `${vt.letterSpacing}px`
    } catch {
      /* unsupported in some WebViews */
    }
  }
  const transformed = applyTextTransform(
    textForPresentation(verse, vn.visible),
    resolveTextTransform(vt.textTransform)
  )
  const lines = wrapText(ctx, transformed, textRectWidth)
  let maxLineWidth = 0
  for (const [index, line] of lines.entries()) {
    const isJustifiedLine =
      verseAlign === "justify" && index < lines.length - 1 && /\s+/.test(line)
    const width = isJustifiedLine ? textRectWidth : ctx.measureText(line).width
    if (width > maxLineWidth) maxLineWidth = width
  }
  ctx.restore()
  return {
    height: Math.max(lineHeightPx, lines.length * lineHeightPx),
    maxLineWidth: Math.max(1, maxLineWidth),
  }
}

function rectForAlignedText(
  align: BroadcastTheme["layout"]["textAlign"],
  drawX: number,
  drawY: number,
  width: number,
  height: number,
  textRect: VerseLayoutRect
): VerseLayoutRect {
  let x = drawX
  if (align === "center") x = drawX - width / 2
  if (align === "right") x = drawX - width
  const clampedX = Math.max(
    textRect.x,
    Math.min(x, textRect.x + textRect.width - width)
  )
  const clampedY = Math.max(textRect.y, drawY)
  return {
    x: clampedX,
    y: clampedY,
    width: Math.min(width, textRect.width),
    height: Math.min(height, textRect.height),
  }
}

function baseLayoutMetrics(
  theme: BroadcastTheme,
  options?: RenderOptions
): {
  scaledTheme: BroadcastTheme
  textAreaRect: VerseLayoutRect
  textRect: VerseLayoutRect
} {
  const scale = options?.scale ?? 1
  const scaledTheme = buildScaledTheme(theme, scale)
  const canvasW = scaledTheme.resolution.width
  const canvasH = scaledTheme.resolution.height
  const layout = scaledTheme.layout
  const bgW = (layout.backgroundWidth / 100) * canvasW
  const bgH = (layout.backgroundHeight / 100) * canvasH
  const textAreaW = (layout.textAreaWidth / 100) * bgW
  const textAreaH = (layout.textAreaHeight / 100) * bgH
  const pos = anchorPosition(
    layout.anchor,
    textAreaW,
    textAreaH,
    canvasW,
    canvasH,
    (options?.offsetX ?? 0) + layout.offsetX,
    (options?.offsetY ?? 0) + layout.offsetY
  )
  const pad = layout.padding
  return {
    scaledTheme,
    textAreaRect: {
      x: pos.x,
      y: pos.y,
      width: textAreaW,
      height: textAreaH,
    },
    textRect: {
      x: pos.x + pad.left,
      y: pos.y + pad.top,
      width: textAreaW - pad.left - pad.right,
      height: textAreaH - pad.top - pad.bottom,
    },
  }
}

function blockVerticalAlignForTheme(theme: BroadcastTheme): TextVerticalAlign {
  return resolveVerticalAlign(
    theme.reference.position === "above"
      ? (theme.reference.verticalAlign ?? theme.verseText.verticalAlign)
      : (theme.verseText.verticalAlign ?? theme.reference.verticalAlign)
  )
}

function measureReferenceWidth(
  ctx: CanvasRenderingContext2D,
  theme: BroadcastTheme,
  verse: VerseRenderData,
  maxWidth: number
): number {
  const refText = applyTextTransform(
    theme.reference.uppercase
      ? verse.reference.toUpperCase()
      : verse.reference,
    resolveTextTransform(theme.reference.textTransform)
  )
  ctx.save()
  ctx.font = `${theme.reference.fontWeight} ${theme.reference.fontSize}px "${theme.reference.fontFamily}", sans-serif`
  const width = Math.max(1, Math.min(maxWidth, ctx.measureText(refText).width))
  ctx.restore()
  return width
}

function presentationBlockHeight(
  theme: BroadcastTheme,
  referenceHeight: number,
  verseHeight: number,
  referenceGap: number
): number {
  if (theme.reference.position === "above") return referenceHeight + verseHeight
  if (theme.reference.position === "below") {
    return verseHeight + referenceGap + referenceHeight
  }
  return verseHeight + referenceHeight
}

export function computeVerseLayoutMetrics(
  ctx: CanvasRenderingContext2D,
  theme: BroadcastTheme,
  verse: VerseRenderData | null,
  options?: RenderOptions
): VerseLayoutMetrics {
  const { scaledTheme, textAreaRect, textRect } = baseLayoutMetrics(
    theme,
    options
  )

  if (!verse) {
    return {
      scaledTheme,
      textAreaRect,
      textRect,
      referenceRect: null,
      verseRect: null,
    }
  }

  const referenceHeight = scaledTheme.reference.fontSize * 1.5
  const verseAlign = resolveHorizontalAlign(
    scaledTheme.verseText.horizontalAlign,
    scaledTheme.layout.textAlign,
    true
  )
  const referenceAlign = resolveHorizontalAlign(
    scaledTheme.reference.horizontalAlign,
    scaledTheme.layout.textAlign,
    false
  )
  const blockVerticalAlign = blockVerticalAlignForTheme(scaledTheme)
  const referenceGap = Math.max(
    0,
    scaledTheme.layout.referenceGap ?? scaledTheme.reference.fontSize * 0.5
  )
  const verseMetrics = measureVerseHeight(ctx, scaledTheme, verse, textRect.width)
  const verseHeight = verseMetrics.height
  const verseDrawX = alignX(
    verseAlign === "justify" ? "left" : verseAlign,
    textRect.x,
    textRect.width
  )
  const referenceDrawX = alignX(
    referenceAlign === "justify" ? "left" : referenceAlign,
    textRect.x,
    textRect.width
  )

  const referenceWidth = measureReferenceWidth(
    ctx,
    scaledTheme,
    verse,
    textRect.width
  )

  const blockHeight = presentationBlockHeight(
    scaledTheme,
    referenceHeight,
    verseHeight,
    referenceGap
  )
  const blockStartY = alignY(
    blockVerticalAlign,
    textRect.y,
    textRect.height,
    blockHeight
  )

  let referenceRect: VerseLayoutRect
  let verseRect: VerseLayoutRect
  if (scaledTheme.reference.position === "above") {
    const refY = blockStartY
    const verseY = blockStartY + referenceHeight
    referenceRect = rectForAlignedText(
      referenceAlign === "justify" ? "left" : referenceAlign,
      referenceDrawX,
      refY,
      referenceWidth,
      referenceHeight,
      textRect
    )
    verseRect = rectForAlignedText(
      verseAlign === "justify" ? "left" : verseAlign,
      verseDrawX,
      verseY,
      verseMetrics.maxLineWidth,
      verseHeight,
      textRect
    )
  } else if (scaledTheme.reference.position === "below") {
    const verseY = blockStartY
    const refY = blockStartY + verseHeight + referenceGap
    verseRect = rectForAlignedText(
      verseAlign === "justify" ? "left" : verseAlign,
      verseDrawX,
      verseY,
      verseMetrics.maxLineWidth,
      verseHeight,
      textRect
    )
    referenceRect = rectForAlignedText(
      referenceAlign === "justify" ? "left" : referenceAlign,
      referenceDrawX,
      refY,
      referenceWidth,
      referenceHeight,
      textRect
    )
  } else {
    const verseY = blockStartY
    const refY = blockStartY + verseHeight
    verseRect = rectForAlignedText(
      verseAlign === "justify" ? "left" : verseAlign,
      verseDrawX,
      verseY,
      verseMetrics.maxLineWidth,
      verseHeight,
      textRect
    )
    referenceRect = rectForAlignedText(
      referenceAlign === "justify" ? "left" : referenceAlign,
      referenceDrawX,
      refY,
      referenceWidth,
      referenceHeight,
      textRect
    )
  }

  return { scaledTheme, textAreaRect, textRect, referenceRect, verseRect }
}
