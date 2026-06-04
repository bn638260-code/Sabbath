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
  /^(?:to\b|from\b|at\b|in\b|[-+]?\d*\.?\d+(?:deg|grad|rad|turn)\b|circle\b|ellipse\b)/i

const COLOR_FUNCTION = /^(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\(/i
const HEX_COLOR = /^#(?:[\da-f]{3,8})\b/i
const CSS_NAMED_COLORS = new Set([
  "aliceblue",
  "antiquewhite",
  "aqua",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "black",
  "blanchedalmond",
  "blue",
  "blueviolet",
  "brown",
  "burlywood",
  "cadetblue",
  "chartreuse",
  "chocolate",
  "coral",
  "cornflowerblue",
  "cornsilk",
  "crimson",
  "cyan",
  "darkblue",
  "darkcyan",
  "darkgoldenrod",
  "darkgray",
  "darkgreen",
  "darkgrey",
  "darkkhaki",
  "darkmagenta",
  "darkolivegreen",
  "darkorange",
  "darkorchid",
  "darkred",
  "darksalmon",
  "darkseagreen",
  "darkslateblue",
  "darkslategray",
  "darkslategrey",
  "darkturquoise",
  "darkviolet",
  "deeppink",
  "deepskyblue",
  "dimgray",
  "dimgrey",
  "dodgerblue",
  "firebrick",
  "floralwhite",
  "forestgreen",
  "fuchsia",
  "gainsboro",
  "ghostwhite",
  "gold",
  "goldenrod",
  "gray",
  "green",
  "greenyellow",
  "grey",
  "honeydew",
  "hotpink",
  "indianred",
  "indigo",
  "ivory",
  "khaki",
  "lavender",
  "lavenderblush",
  "lawngreen",
  "lemonchiffon",
  "lightblue",
  "lightcoral",
  "lightcyan",
  "lightgoldenrodyellow",
  "lightgray",
  "lightgreen",
  "lightgrey",
  "lightpink",
  "lightsalmon",
  "lightseagreen",
  "lightskyblue",
  "lightslategray",
  "lightslategrey",
  "lightsteelblue",
  "lightyellow",
  "lime",
  "limegreen",
  "linen",
  "magenta",
  "maroon",
  "mediumaquamarine",
  "mediumblue",
  "mediumorchid",
  "mediumpurple",
  "mediumseagreen",
  "mediumslateblue",
  "mediumspringgreen",
  "mediumturquoise",
  "mediumvioletred",
  "midnightblue",
  "mintcream",
  "mistyrose",
  "moccasin",
  "navajowhite",
  "navy",
  "oldlace",
  "olive",
  "olivedrab",
  "orange",
  "orangered",
  "orchid",
  "palegoldenrod",
  "palegreen",
  "paleturquoise",
  "palevioletred",
  "papayawhip",
  "peachpuff",
  "peru",
  "pink",
  "plum",
  "powderblue",
  "purple",
  "rebeccapurple",
  "red",
  "rosybrown",
  "royalblue",
  "saddlebrown",
  "salmon",
  "sandybrown",
  "seagreen",
  "seashell",
  "sienna",
  "silver",
  "skyblue",
  "slateblue",
  "slategray",
  "slategrey",
  "snow",
  "springgreen",
  "steelblue",
  "tan",
  "teal",
  "thistle",
  "tomato",
  "transparent",
  "turquoise",
  "violet",
  "wheat",
  "white",
  "whitesmoke",
  "yellow",
  "yellowgreen",
  "canvas",
  "canvastext",
  "linktext",
  "visitedtext",
  "activetext",
  "buttonface",
  "buttontext",
  "buttonborder",
  "field",
  "fieldtext",
  "highlight",
  "highlighttext",
  "selecteditem",
  "selecteditemtext",
  "mark",
  "marktext",
  "graytext",
  "accentcolor",
  "accentcolortext",
  "currentcolor",
])

function startsWithNamedColor(value: string) {
  const namedColor = value.match(/^[a-z-]+/i)?.[0]?.toLowerCase()
  return namedColor ? CSS_NAMED_COLORS.has(namedColor) : false
}

function isGradientColorStop(part: string) {
  const value = part.trim()

  if (NON_COLOR_GRADIENT_TOKENS.test(value)) {
    return false
  }

  return HEX_COLOR.test(value) || COLOR_FUNCTION.test(value) || startsWithNamedColor(value)
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
