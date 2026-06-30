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
