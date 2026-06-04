type TutorialArrowStyle = Pick<
  CSSStyleDeclaration,
  "backgroundColor" | "backgroundImage"
>

const TRANSPARENT_COLORS = new Set(["", "transparent", "rgba(0, 0, 0, 0)"])

function isUsableColor(value: string | undefined) {
  return value ? !TRANSPARENT_COLORS.has(value.trim().toLowerCase()) : false
}

function splitTopLevelCommas(value: string) {
  const parts: string[] = []
  let depth = 0
  let start = 0

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char === "(") depth += 1
    if (char === ")") depth = Math.max(0, depth - 1)
    if (char === "," && depth === 0) {
      parts.push(value.slice(start, index).trim())
      start = index + 1
    }
  }

  parts.push(value.slice(start).trim())
  return parts
}

const NON_COLOR_GRADIENT_TOKENS =
  /^(?:to\b|from\b|[-+]?\d*\.?\d+(?:deg|grad|rad|turn)\b|circle\b|ellipse\b|at\b)/i

function isGradientColorStop(part: string) {
  const value = part.trim()

  if (NON_COLOR_GRADIENT_TOKENS.test(value)) {
    return false
  }

  return /^(?:#|rgb|hsl|hwb|oklch|oklab|lab|lch|color\(|[a-z][a-z-]*)/i.test(value)
}

function extractFirstGradientColor(backgroundImage: string) {
  const gradientMatch = backgroundImage.match(
    /(?:repeating-)?(?:linear|radial|conic)-gradient\((.*)\)/i
  )
  if (!gradientMatch?.[1]) return undefined

  return splitTopLevelCommas(gradientMatch[1]).find(isGradientColorStop)
}

export function getTutorialArrowColor(style: TutorialArrowStyle) {
  return (
    extractFirstGradientColor(style.backgroundImage) ??
    (isUsableColor(style.backgroundColor) ? style.backgroundColor : undefined)
  )
}
