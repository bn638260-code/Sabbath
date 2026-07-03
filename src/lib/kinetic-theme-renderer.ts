import type { BroadcastKineticTheme, BroadcastTheme } from "@/types/broadcast"
import worshipPortraitUrl from "@/assets/worship-portrait.webp"

// ---------------------------------------------------------------------------
// Canvas-native kinetic background renderer
//
// Mirrors the HTML prototype's CSS motion (liquidMesh + vigorousDrift + the
// cyberpunk dot-grid and brutalist diagonal stripes) using only 2D canvas draw
// calls so the same moving background works for the live output AND the NDI
// frame path. It is deterministic: a given (theme, timeMs) always produces the
// same draw calls, which keeps tests stable and makes timeMs=0 a usable static
// thumbnail frame.
//
// No CSS, no DOM measurement, no external images — except the bundled Desert
// Cloth portrait asset, which is decoded once and skipped until loaded so
// determinism per (theme, timeMs, assetsLoaded) still holds.
// ---------------------------------------------------------------------------

const TAU = Math.PI * 2

export function isKineticTheme(
  theme: BroadcastTheme,
): theme is BroadcastTheme & { kinetic: BroadcastKineticTheme } {
  return Boolean(theme.kinetic)
}

/** Normalized loop position in [0, 1). Stable at timeMs=0; 0 when no duration. */
export function kineticLoopPhase(timeMs: number, durationMs: number): number {
  if (!Number.isFinite(timeMs) || durationMs <= 0) return 0
  const wrapped = ((timeMs % durationMs) + durationMs) % durationMs
  return wrapped / durationMs
}

function colorsOf(k: BroadcastKineticTheme): string[] {
  return k.colors.length > 0 ? k.colors : ["#05060f", "#11142b"]
}

function drawMeshBase(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  k: BroadcastKineticTheme,
  phase: number,
): void {
  const colors = colorsOf(k)
  // Rotate the gradient axis over the loop (the prototype shifts
  // background-position; an angle sweep reads the same on a flat canvas).
  const angle =
    (135 + Math.sin(phase * TAU) * 25 * Math.max(0.1, k.motion.driftAmount)) *
    (Math.PI / 180)
  const cx = width / 2
  const cy = height / 2
  const len = Math.sqrt(width * width + height * height) / 2
  const grad = ctx.createLinearGradient(
    cx - Math.cos(angle) * len,
    cy - Math.sin(angle) * len,
    cx + Math.cos(angle) * len,
    cy + Math.sin(angle) * len,
  )
  for (let i = 0; i < colors.length; i++) {
    grad.addColorStop(i / Math.max(1, colors.length - 1), colors[i])
  }
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
}

function drawDriftBlobs(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  k: BroadcastKineticTheme,
  phase: number,
): void {
  const colors = colorsOf(k)
  const drift = Math.max(0, k.motion.driftAmount)
  const radius = Math.max(width, height) * 0.55

  ctx.save()
  // Soft, additive luminous blobs like the ambient drift layer. Filters are
  // guarded because some WebViews / test contexts don't support them.
  try {
    ctx.globalAlpha = 0.55
  } catch {
    /* noop */
  }

  const blobs = Math.min(4, colors.length)
  for (let i = 0; i < blobs; i++) {
    const t = phase * TAU + (i / blobs) * TAU
    const ox = Math.cos(t) * drift * width * 0.22
    const oy = Math.sin(t * 0.8 + i) * drift * height * 0.22
    const baseX = width * (0.3 + 0.4 * ((i % 2) === 0 ? 0 : 1))
    const baseY = height * (0.32 + 0.36 * (i < 2 ? 0 : 1))
    const grad = ctx.createRadialGradient(
      baseX + ox,
      baseY + oy,
      0,
      baseX + ox,
      baseY + oy,
      radius,
    )
    grad.addColorStop(0, colors[i % colors.length])
    grad.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
  }

  // Accent glow that breathes with the loop (cyberPulse).
  const pulse = 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(phase * TAU))
  const glowX = width * 0.5 + Math.cos(phase * TAU) * width * 0.18 * drift
  const glowY = height * 0.5 + Math.sin(phase * TAU) * height * 0.18 * drift
  const glow = ctx.createRadialGradient(
    glowX,
    glowY,
    0,
    glowX,
    glowY,
    radius * 0.7,
  )
  glow.addColorStop(0, k.accentColor)
  glow.addColorStop(1, "rgba(0,0,0,0)")
  ctx.save()
  ctx.globalAlpha = pulse
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)
  ctx.restore()

  ctx.restore()
}

function drawDotGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  k: BroadcastKineticTheme,
  phase: number,
): void {
  const spacing = Math.max(24, Math.round(width / 48))
  const dotRadius = Math.max(1.5, spacing * 0.08)
  // Scroll the grid diagonally over the loop (gridScroll).
  const shift = (phase * spacing) % spacing
  ctx.save()
  ctx.globalAlpha = 0.5
  ctx.fillStyle = k.accentColor
  for (let y = -spacing; y < height + spacing; y += spacing) {
    for (let x = -spacing; x < width + spacing; x += spacing) {
      ctx.beginPath()
      ctx.arc(x + shift, y + shift, dotRadius, 0, TAU)
      ctx.fill()
    }
  }
  ctx.restore()
}

function drawDiagonalStripes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  k: BroadcastKineticTheme,
  phase: number,
): void {
  const band = Math.max(28, Math.round(width / 30))
  const period = band * 2
  const shift = (phase * period) % period
  const span = width + height
  ctx.save()
  ctx.globalAlpha = 0.08
  ctx.fillStyle = k.accentColor
  // Diagonal (45deg) stripes as filled parallelograms sweeping across.
  for (let offset = -span; offset < span; offset += period) {
    const x = offset + shift
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + band, 0)
    ctx.lineTo(x + band - height, height)
    ctx.lineTo(x - height, height)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------
// Nature scenes
//
// Deterministic particle systems (rain, snow, drifting leaves/petals, glowing
// motes, stars, aurora). Every element's position is a pure function of its
// index seed and timeMs, so a given (theme, timeMs) always produces the same
// frame — timeMs=0 is a stable thumbnail — with no per-frame state retained.
// Only cheap primitives are used (arcs, lines, filled polygons, one gradient);
// no shadow blur or per-particle gradients, so the 15fps CPU budget holds.
// ---------------------------------------------------------------------------

const NATURE_KINDS: ReadonlySet<string> = new Set([
  "foliage",
  "forest",
  "rain",
  "autumn",
  "blossom",
  "snow",
  "fireflies",
  "stars",
  "meadow",
  "aurora",
])

/** Deterministic [0, 1) hash for a particle index. */
function srand(n: number): number {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h
  const int = Number.parseInt(full, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

/** Overall particle speed multiplier from the preset's drift amount. */
function driftSpeed(k: BroadcastKineticTheme): number {
  return 0.5 + Math.max(0, k.motion.driftAmount)
}

/** Calm vertical gradient backdrop behind the particles. */
function drawNatureBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  k: BroadcastKineticTheme,
): void {
  const colors = colorsOf(k)
  const grad = ctx.createLinearGradient(0, 0, 0, height)
  for (let i = 0; i < colors.length; i++) {
    grad.addColorStop(i / Math.max(1, colors.length - 1), colors[i])
  }
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
}

function drawFallingLeaves(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  k: BroadcastKineticTheme,
  t: number,
  opts: { count: number; size: number; petal: boolean },
): void {
  const [r, g, b] = hexToRgb(k.accentColor)
  const speed = 0.12 * driftSpeed(k)
  const range = height + 80
  for (let i = 0; i < opts.count; i++) {
    const phase = srand(i + 31) * TAU
    const swayAmp = 20 + srand(i + 17) * 30
    const fall = (srand(i + 3) * range + t * speed * (0.6 + srand(i + 5) * 0.8)) % range
    const y = fall - 40
    const x = srand(i) * width + Math.sin(t * 0.0006 + phase) * swayAmp
    const rot = phase + t * 0.0004 * (srand(i + 7) > 0.5 ? 1 : -1)
    const s = opts.size * (0.7 + srand(i + 13) * 0.6)
    const alpha = 0.5 + srand(i + 19) * 0.4
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.beginPath()
    if (opts.petal) {
      ctx.moveTo(0, -s * 0.5)
      ctx.lineTo(s * 0.5, 0)
      ctx.lineTo(0, s * 0.5)
      ctx.lineTo(-s * 0.5, 0)
    } else {
      ctx.moveTo(0, -s)
      ctx.lineTo(s * 0.36, 0)
      ctx.lineTo(0, s)
      ctx.lineTo(-s * 0.36, 0)
    }
    ctx.closePath()
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
    ctx.fill()
    ctx.restore()
  }
}

function drawRain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  k: BroadcastKineticTheme,
  t: number,
): void {
  const [r, g, b] = hexToRgb(k.accentColor)
  const speed = 0.7 * driftSpeed(k)
  const range = height + 40
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.32)`
  ctx.lineWidth = 1.3
  for (let i = 0; i < 100; i++) {
    const x = srand(i) * width
    const len = 12 + srand(i + 7) * 18
    const y = (srand(i + 3) * range + t * speed * (0.7 + srand(i + 9) * 0.6)) % range
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - 4, y - len)
    ctx.stroke()
  }
}

function drawSnow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  k: BroadcastKineticTheme,
  t: number,
): void {
  const speed = 0.06 * driftSpeed(k)
  const range = height + 20
  for (let i = 0; i < 80; i++) {
    const depth = srand(i + 5)
    const radius = 1 + depth * 3
    const y = (srand(i + 3) * range + t * speed * (0.4 + depth)) % range
    const x = srand(i) * width + Math.sin(t * 0.0008 + srand(i + 11) * TAU) * (4 + depth * 6)
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, TAU)
    ctx.fillStyle = `rgba(240, 248, 255, ${0.4 + depth * 0.5})`
    ctx.fill()
  }
}

/** Rising glowing motes — fireflies and drifting pollen. */
function drawGlowMotes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  k: BroadcastKineticTheme,
  t: number,
  count: number,
): void {
  const [r, g, b] = hexToRgb(k.accentColor)
  const speed = 0.05 * driftSpeed(k)
  const range = height + 40
  for (let i = 0; i < count; i++) {
    const phase = srand(i + 23) * TAU
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.003 + phase)
    const raw = (srand(i + 3) * range + t * speed * (0.5 + srand(i + 5))) % range
    const y = height - raw
    const x = srand(i) * width + Math.sin(t * 0.0009 + phase) * 24
    const radius = 1.4 + srand(i + 13) * 2
    ctx.beginPath()
    ctx.arc(x, y, radius * 2.6, 0, TAU)
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.1 * pulse})`
    ctx.fill()
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, TAU)
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.85 * pulse})`
    ctx.fill()
  }
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  k: BroadcastKineticTheme,
  t: number,
): void {
  const [r, g, b] = hexToRgb(k.accentColor)
  for (let i = 0; i < 90; i++) {
    const x = srand(i) * width
    const y = srand(i + 3) * height * 0.85
    const phase = srand(i + 7) * TAU
    const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.002 + phase))
    const radius = 0.6 + srand(i + 11) * 1.4
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, TAU)
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${twinkle})`
    ctx.fill()
  }
}

/** Flowing translucent light bands over a starfield. */
function drawAurora(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  k: BroadcastKineticTheme,
  t: number,
): void {
  drawStars(ctx, width, height, k, t)
  const [r, g, b] = hexToRgb(k.accentColor)
  const bands = 3
  const steps = 12
  for (let band = 0; band < bands; band++) {
    const baseY = height * (0.22 + band * 0.16)
    const amp = 30 + band * 20
    const phase = band * 1.7
    ctx.beginPath()
    ctx.moveTo(0, baseY)
    for (let s = 0; s <= steps; s++) {
      const x = (s / steps) * width
      const y = baseY + Math.sin(x * 0.004 + t * 0.0006 + phase) * amp
      ctx.lineTo(x, y)
    }
    ctx.lineTo(width, baseY + 130)
    ctx.lineTo(0, baseY + 130)
    ctx.closePath()
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.06 + band * 0.02})`
    ctx.fill()
  }
}

function drawNatureScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  k: BroadcastKineticTheme,
  t: number,
): void {
  drawNatureBackdrop(ctx, width, height, k)
  switch (k.backgroundKind) {
    case "foliage":
      drawFallingLeaves(ctx, width, height, k, t, { count: 30, size: 15, petal: false })
      break
    case "forest":
      drawFallingLeaves(ctx, width, height, k, t, { count: 22, size: 20, petal: false })
      break
    case "autumn":
      drawFallingLeaves(ctx, width, height, k, t, { count: 40, size: 16, petal: false })
      break
    case "blossom":
      drawFallingLeaves(ctx, width, height, k, t, { count: 40, size: 12, petal: true })
      break
    case "rain":
      drawRain(ctx, width, height, k, t)
      break
    case "snow":
      drawSnow(ctx, width, height, k, t)
      break
    case "fireflies":
      drawGlowMotes(ctx, width, height, k, t, 44)
      break
    case "meadow":
      drawGlowMotes(ctx, width, height, k, t, 40)
      break
    case "stars":
      drawStars(ctx, width, height, k, t)
      break
    case "aurora":
      drawAurora(ctx, width, height, k, t)
      break
    default:
      break
  }
}

// ---------------------------------------------------------------------------
// Desert Cloth worship scene — 1:1 canvas port of worship_background HTML
// (sand cloth folds + sheen + weave + vignette + glowing cross + portrait).
// All literal values are transcribed from the HTML's CSS; see the plan's
// DESIGN FIDELITY SPEC before changing any of them.
// ---------------------------------------------------------------------------

const CLOTH = {
  base: ["#cbab7f", "#b8956a", "#8a6a45"],
  sandGlow: "#f3e3c2",
  sandLight: "#e3cba4",
  sandDeep: "#8a6a45",
  darkMid: "#6f5334",
} as const

const CLOTH_DESIGN_WIDTH = 1920
const CLOTH_DESIGN_HEIGHT = 1080

function clothScale(width: number, height: number): number {
  return Math.min(width / CLOTH_DESIGN_WIDTH, height / CLOTH_DESIGN_HEIGHT)
}

function clothPx(scale: number, value: number): number {
  return value * scale
}

/** [stopPosition, translateY%, rotateDeg, scaleY, skewXDeg] */
type GustFrame = [number, number, number, number, number]
type CubicBezier = [number, number, number, number]

const GUSTS: GustFrame[][] = [
  [
    [0, 1, -11, 0.85, 0],
    [0.22, -4, -6, 1.35, -7],
    [0.38, -1, -9, 0.95, 3],
    [0.55, -5, -5, 1.28, -9],
    [0.72, 2, -10, 0.9, 2],
    [1, 1, -11, 0.85, 0],
  ],
  [
    [0, -2, -6, 1.2, -6],
    [0.18, 3, -11, 0.8, 5],
    [0.4, -5, -5, 1.4, -10],
    [0.58, 0, -8, 1, 0],
    [0.78, -3, -5, 1.25, -8],
    [1, -2, -6, 1.2, -6],
  ],
  [
    [0, 2, -12, 0.82, 4],
    [0.25, -6, -5, 1.38, -11],
    [0.45, 1, -9, 0.92, 2],
    [0.65, -4, -4, 1.3, -8],
    [0.85, 2, -10, 0.88, 3],
    [1, 2, -12, 0.82, 4],
  ],
]

interface ClothFold {
  top: number // fraction of frame height
  light: boolean
  durationMs: number
  delayMs: number
  gust: 0 | 1 | 2
  easing: CubicBezier
}

const CLOTH_FOLDS: ClothFold[] = [
  { top: 0.02, light: true, durationMs: 6500, delayMs: 0, gust: 0, easing: [0.45, 0.05, 0.35, 1] },
  { top: 0.2, light: false, durationMs: 7800, delayMs: -2200, gust: 1, easing: [0.5, 0.1, 0.3, 1] },
  { top: 0.38, light: true, durationMs: 5900, delayMs: -1100, gust: 2, easing: [0.45, 0.05, 0.35, 1] },
  { top: 0.55, light: false, durationMs: 8400, delayMs: -3600, gust: 0, easing: [0.5, 0.1, 0.3, 1] },
  { top: 0.72, light: true, durationMs: 6200, delayMs: -4400, gust: 1, easing: [0.45, 0.05, 0.35, 1] },
  { top: 0.88, light: false, durationMs: 7100, delayMs: -800, gust: 2, easing: [0.5, 0.1, 0.3, 1] },
]

/** y of a CSS cubic-bezier timing function at progress t (Newton refinement). */
function cubicBezierEase(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  t: number,
): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const cx = 3 * p1x
  const bx = 3 * (p2x - p1x) - cx
  const ax = 1 - cx - bx
  const cy = 3 * p1y
  const by = 3 * (p2y - p1y) - cy
  const ay = 1 - cy - by
  let u = t
  for (let i = 0; i < 8; i++) {
    const x = ((ax * u + bx) * u + cx) * u - t
    const d = (3 * ax * u + 2 * bx) * u + cx
    if (Math.abs(x) < 1e-5 || d === 0) break
    u -= x / d
  }
  if (u < 0) u = 0
  if (u > 1) u = 1
  return ((ay * u + by) * u + cy) * u
}

function gustTransform(
  gust: 0 | 1 | 2,
  easing: CubicBezier,
  phase: number,
): { ty: number; rot: number; sy: number; skx: number } {
  const frames = GUSTS[gust]
  const [x1, y1, x2, y2] = easing
  let a = frames[0]
  let b = frames[frames.length - 1]
  for (let i = 0; i < frames.length - 1; i++) {
    if (phase >= frames[i][0] && phase <= frames[i + 1][0]) {
      a = frames[i]
      b = frames[i + 1]
      break
    }
  }
  const span = Math.max(1e-6, b[0] - a[0])
  const t = cubicBezierEase(x1, y1, x2, y2, (phase - a[0]) / span)
  return {
    ty: a[1] + (b[1] - a[1]) * t,
    rot: a[2] + (b[2] - a[2]) * t,
    sy: a[3] + (b[3] - a[3]) * t,
    skx: a[4] + (b[4] - a[4]) * t,
  }
}

function drawClothFolds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  scale: number,
): void {
  const bandW = width * 1.6
  const bandH = height * 0.34
  for (const fold of CLOTH_FOLDS) {
    const phase = kineticLoopPhase(t - fold.delayMs, fold.durationMs)
    const { ty, rot, sy, skx } = gustTransform(fold.gust, fold.easing, phase)
    const cx = -0.3 * width + bandW / 2
    const cy = fold.top * height + bandH / 2 + (ty / 100) * bandH
    ctx.save()
    ctx.globalAlpha = fold.light ? 0.6 : 0.42
    ctx.filter = `blur(${clothPx(scale, 34)}px)`
    ctx.translate(cx, cy)
    ctx.rotate((rot * Math.PI) / 180)
    ctx.transform(1, 0, Math.tan((skx * Math.PI) / 180), 1, 0, 0)
    ctx.scale(1, sy)
    const grad = ctx.createLinearGradient(-bandW / 2, 0, bandW / 2, 0)
    if (fold.light) {
      grad.addColorStop(0, "rgba(243,227,194,0)")
      grad.addColorStop(0.35, CLOTH.sandGlow)
      grad.addColorStop(0.55, CLOTH.sandLight)
      grad.addColorStop(1, "rgba(227,203,164,0)")
    } else {
      grad.addColorStop(0, "rgba(138,106,69,0)")
      grad.addColorStop(0.4, CLOTH.sandDeep)
      grad.addColorStop(0.6, CLOTH.darkMid)
      grad.addColorStop(1, "rgba(111,83,52,0)")
    }
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.ellipse(0, 0, bandW / 2, bandH / 2, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
  }
}

function drawClothSheen(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.save()
  ctx.globalCompositeOperation = "soft-light"
  const angle = (115 * Math.PI) / 180
  const cx = width / 2
  const cy = height / 2
  const len = Math.sqrt(width * width + height * height) / 2
  const grad = ctx.createLinearGradient(
    cx - Math.cos(angle) * len,
    cy - Math.sin(angle) * len,
    cx + Math.cos(angle) * len,
    cy + Math.sin(angle) * len,
  )
  grad.addColorStop(0.3, "rgba(255,244,220,0)")
  grad.addColorStop(0.5, "rgba(255,244,220,0.18)")
  grad.addColorStop(0.7, "rgba(255,244,220,0)")
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

let weaveCanvas: HTMLCanvasElement | null = null
let weaveSizeKey = ""

function drawClothWeave(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
): void {
  try {
    const key = `${width}x${height}`
    if (!weaveCanvas || weaveSizeKey !== key) {
      const c = document.createElement("canvas")
      c.width = width
      c.height = height
      const wctx = c.getContext("2d")
      if (!wctx) return
      const spacing = Math.max(1, clothPx(scale, 3))
      const line = Math.max(0.5, clothPx(scale, 1))
      wctx.fillStyle = "rgba(61,43,23,0.7)"
      for (let y = 0; y < height; y += spacing) wctx.fillRect(0, y, width, line)
      for (let x = 0; x < width; x += spacing) wctx.fillRect(x, 0, line, height)
      weaveCanvas = c
      weaveSizeKey = key
    }
    ctx.save()
    ctx.globalAlpha = 0.05
    ctx.drawImage(weaveCanvas, 0, 0)
    ctx.restore()
  } catch {
    // Non-DOM environment (tests): the weave is a subtle texture, safe to skip.
  }
}

function drawClothVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const grad = ctx.createRadialGradient(
    width * 0.42,
    height * 0.46,
    0,
    width * 0.42,
    height * 0.46,
    Math.max(width, height) * 0.72,
  )
  grad.addColorStop(0.55, "rgba(61,43,23,0)")
  grad.addColorStop(1, "rgba(61,43,23,0.28)")
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)
}

function drawClothCross(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  scale: number,
): void {
  void width
  const phase = kineticLoopPhase(t, 6000)
  const wave = 0.5 - 0.5 * Math.cos(phase * TAU) // 0→1→0 ease-in-out loop
  const w = clothPx(scale, 96)
  const h = clothPx(scale, 140)
  const bar = clothPx(scale, 18)
  const x = clothPx(scale, 52)
  const y = height - clothPx(scale, 44) - h - clothPx(scale, 4) * wave
  const cx = x + w / 2
  const cy = y + h / 2

  // Halo: pulses opacity .55→.9 and scale 1→1.1 on the same 6s loop.
  const haloR = (Math.max(w, h) / 2 + clothPx(scale, 36)) * (1 + 0.1 * wave)
  ctx.save()
  ctx.globalAlpha = 0.55 + 0.35 * wave
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR)
  halo.addColorStop(0, "rgba(255,240,205,0.5)")
  halo.addColorStop(0.68, "rgba(255,240,205,0)")
  ctx.fillStyle = halo
  ctx.fillRect(cx - haloR, cy - haloR, haloR * 2, haloR * 2)
  ctx.restore()

  // Bars: 160deg gold gradient, outer shadow, soft inner highlight stroke.
  ctx.save()
  ctx.shadowColor = "rgba(61,43,23,0.4)"
  ctx.shadowBlur = clothPx(scale, 14)
  ctx.shadowOffsetY = clothPx(scale, 3)
  const angle = (160 * Math.PI) / 180
  const len = Math.sqrt(w * w + h * h) / 2
  const grad = ctx.createLinearGradient(
    cx - Math.sin(angle) * len,
    cy + Math.cos(angle) * len,
    cx + Math.sin(angle) * len,
    cy - Math.cos(angle) * len,
  )
  grad.addColorStop(0, "#f3e3c2")
  grad.addColorStop(0.7, "#caa76e")
  grad.addColorStop(1, "#a8834e")
  ctx.fillStyle = grad
  const bars: [number, number, number, number][] = [
    [cx - bar / 2, y, bar, h], // vertical
    [x, y + clothPx(scale, 32), w, bar], // horizontal, top at 32px
  ]
  for (const [bx, by, bw, bh] of bars) {
    ctx.beginPath()
    if (typeof ctx.roundRect === "function") ctx.roundRect(bx, by, bw, bh, clothPx(scale, 3))
    else ctx.rect(bx, by, bw, bh)
    ctx.fill()
  }
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = "rgba(255,248,230,0.55)"
  ctx.lineWidth = Math.max(0.5, clothPx(scale, 2))
  for (const [bx, by, bw, bh] of bars) {
    const inset = Math.max(0.5, clothPx(scale, 1))
    ctx.strokeRect(bx + inset, by + inset, bw - inset * 2, bh - inset * 2)
  }
  ctx.restore()
}

// Portrait asset: decoded once per session. Until it loads, the scene simply
// draws without it; static thumbnail hosts subscribe below for one redraw.
let portraitImage: HTMLImageElement | null = null
let portraitLoaded = false
let portraitRequested = false
let portraitMasked: HTMLCanvasElement | null = null
const portraitLoadListeners = new Set<() => void>()

export function onClothPortraitLoaded(callback: () => void): () => void {
  if (portraitLoaded) {
    callback()
    return () => {}
  }
  portraitLoadListeners.add(callback)
  return () => {
    portraitLoadListeners.delete(callback)
  }
}

function requestPortrait(): HTMLImageElement | null {
  if (!portraitRequested) {
    portraitRequested = true
    try {
      const img = new Image()
      img.onload = () => {
        portraitLoaded = true
        for (const listener of portraitLoadListeners) listener()
      }
      img.src = worshipPortraitUrl
      portraitImage = img
    } catch {
      // Non-DOM environment (tests): scene renders without the portrait.
    }
  }
  return portraitLoaded && portraitImage ? portraitImage : null
}

/** Left-edge alpha fade (transparent → .85 @22% → 1 @40%), cached once. */
function maskedPortrait(img: HTMLImageElement): HTMLCanvasElement | HTMLImageElement {
  if (portraitMasked) return portraitMasked
  try {
    const c = document.createElement("canvas")
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const mctx = c.getContext("2d")
    if (!mctx) return img
    mctx.drawImage(img, 0, 0)
    const grad = mctx.createLinearGradient(0, 0, c.width, 0)
    grad.addColorStop(0, "rgba(0,0,0,0)")
    grad.addColorStop(0.22, "rgba(0,0,0,0.85)")
    grad.addColorStop(0.4, "rgba(0,0,0,1)")
    grad.addColorStop(1, "rgba(0,0,0,1)")
    mctx.globalCompositeOperation = "destination-in"
    mctx.fillStyle = grad
    mctx.fillRect(0, 0, c.width, c.height)
    portraitMasked = c
    return c
  } catch {
    return img
  }
}

function drawClothPortrait(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
): void {
  const img = requestPortrait()
  if (!img || img.naturalHeight === 0) return
  const source = maskedPortrait(img)
  const drawH = height
  const drawW = height * (img.naturalWidth / img.naturalHeight)
  const drawX = width - drawW
  ctx.save()
  ctx.shadowColor = "rgba(61,43,23,0.35)"
  ctx.shadowBlur = clothPx(scale, 34)
  ctx.shadowOffsetX = -clothPx(scale, 14)
  ctx.drawImage(source, drawX, 0, drawW, drawH)
  ctx.restore()
}

function drawClothScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
): void {
  const scale = clothScale(width, height)
  // Base: linear-gradient(135deg, sand-mid 0%, sand 45%, sand-deep 100%).
  const angle = (135 * Math.PI) / 180
  const cx = width / 2
  const cy = height / 2
  const len = Math.sqrt(width * width + height * height) / 2
  const grad = ctx.createLinearGradient(
    cx - Math.cos(angle) * len,
    cy - Math.sin(angle) * len,
    cx + Math.cos(angle) * len,
    cy + Math.sin(angle) * len,
  )
  grad.addColorStop(0, CLOTH.base[0])
  grad.addColorStop(0.45, CLOTH.base[1])
  grad.addColorStop(1, CLOTH.base[2])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  drawClothFolds(ctx, width, height, t, scale)
  drawClothSheen(ctx, width, height)
  drawClothWeave(ctx, width, height, scale)
  drawClothVignette(ctx, width, height)
  drawClothPortrait(ctx, width, height, scale)
  drawClothCross(ctx, width, height, t, scale)
}

/**
 * Draws the kinetic moving background for `theme` at `timeMs`. Returns `true`
 * when it handled the background (caller should skip the static background) and
 * `false` for non-kinetic themes or when drawing failed (caller falls back to
 * the theme's static `background`).
 */
export function drawKineticBackground(
  ctx: CanvasRenderingContext2D,
  theme: BroadcastTheme,
  timeMs = 0,
): boolean {
  const k = theme.kinetic
  if (!k) return false

  try {
    const { width, height } = theme.resolution

    if (k.backgroundKind === "cloth") {
      drawClothScene(ctx, width, height, timeMs)
      return true
    }

    if (NATURE_KINDS.has(k.backgroundKind)) {
      drawNatureScene(ctx, width, height, k, timeMs)
      return true
    }

    const phase = kineticLoopPhase(timeMs, k.motion.durationMs)

    drawMeshBase(ctx, width, height, k, phase)
    drawDriftBlobs(ctx, width, height, k, phase)

    if (k.backgroundKind === "grid" || k.pattern === "dot-grid") {
      drawDotGrid(ctx, width, height, k, phase)
    }
    if (k.backgroundKind === "stripes" || k.pattern === "diagonal-stripes") {
      drawDiagonalStripes(ctx, width, height, k, phase)
    }
    return true
  } catch (e) {
    console.error("[kinetic-theme-renderer] draw error:", e)
    return false
  }
}
