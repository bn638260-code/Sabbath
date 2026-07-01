import type { BroadcastKineticTheme, BroadcastTheme } from "@/types/broadcast"

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
// No CSS, no DOM measurement, no external images.
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
