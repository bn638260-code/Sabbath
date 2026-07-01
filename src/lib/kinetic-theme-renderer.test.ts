import { describe, expect, it, vi } from "vitest"
import { drawKineticBackground, isKineticTheme, kineticLoopPhase } from "./kinetic-theme-renderer"
import { buildKineticBroadcastTheme, KINETIC_THEME_PRESETS } from "./kinetic-themes"
import { BUILTIN_THEMES } from "./builtin-themes"
import type { BroadcastTheme } from "@/types"

function preset(id: string) {
  const p = KINETIC_THEME_PRESETS.find((x) => x.presetId === id)
  if (!p) throw new Error(`missing preset ${id}`)
  return buildKineticBroadcastTheme(p)
}

interface Recorder {
  ctx: CanvasRenderingContext2D
  radial: unknown[][]
  linear: unknown[][]
  arcArgs: unknown[][]
  arcs: number
  paths: number
  fillRects: number
}

function createRecorder(): Recorder {
  const radial: unknown[][] = []
  const linear: unknown[][] = []
  const arcArgs: unknown[][] = []
  const rec = { arcs: 0, paths: 0, fillRects: 0 }
  const gradient = { addColorStop: vi.fn() }
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(() => {
      rec.fillRects += 1
    }),
    clearRect: vi.fn(),
    beginPath: vi.fn(() => {
      rec.paths += 1
    }),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn((...args: unknown[]) => {
      rec.arcs += 1
      arcArgs.push(args)
    }),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    createLinearGradient: vi.fn((...args: unknown[]) => {
      linear.push(args)
      return gradient
    }),
    createRadialGradient: vi.fn((...args: unknown[]) => {
      radial.push(args)
      return gradient
    }),
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    filter: "none",
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D
  return { ctx, radial, linear, arcArgs, get arcs() { return rec.arcs }, get paths() { return rec.paths }, get fillRects() { return rec.fillRects } } as Recorder
}

describe("isKineticTheme", () => {
  it("is false for static built-ins and true for kinetic presets", () => {
    expect(isKineticTheme(BUILTIN_THEMES[0])).toBe(false)
    expect(isKineticTheme(preset("ocean"))).toBe(true)
  })
})

describe("kineticLoopPhase", () => {
  it("wraps into 0..1 and is stable for timeMs=0", () => {
    expect(kineticLoopPhase(0, 6000)).toBe(0)
    expect(kineticLoopPhase(6000, 6000)).toBe(0)
    expect(kineticLoopPhase(3000, 6000)).toBeCloseTo(0.5)
    expect(kineticLoopPhase(-1, 6000)).toBeGreaterThanOrEqual(0)
    expect(kineticLoopPhase(1000, 0)).toBe(0)
  })
})

describe("drawKineticBackground", () => {
  it("returns false and draws nothing for non-kinetic themes", () => {
    const r = createRecorder()
    const drew = drawKineticBackground(r.ctx, BUILTIN_THEMES[0] as BroadcastTheme, 0)
    expect(drew).toBe(false)
    expect(r.fillRects).toBe(0)
  })

  it("draws a deterministic frame: same timeMs => identical gradient calls", () => {
    const a = createRecorder()
    const b = createRecorder()
    drawKineticBackground(a.ctx, preset("ocean"), 0)
    drawKineticBackground(b.ctx, preset("ocean"), 0)
    expect(a.radial).toEqual(b.radial)
    expect(a.linear).toEqual(b.linear)
  })

  it("changes the frame when timeMs advances", () => {
    const a = createRecorder()
    const b = createRecorder()
    drawKineticBackground(a.ctx, preset("ocean"), 0)
    drawKineticBackground(b.ctx, preset("ocean"), 1500)
    expect(a.radial).not.toEqual(b.radial)
  })

  it("draws dot-grid arcs for cyberpunk", () => {
    const r = createRecorder()
    drawKineticBackground(r.ctx, preset("cyberpunk"), 0)
    expect(r.arcs).toBeGreaterThan(0)
  })

  it("draws diagonal stripe paths for brutalist", () => {
    const r = createRecorder()
    drawKineticBackground(r.ctx, preset("brutalist"), 0)
    expect(r.paths).toBeGreaterThan(0)
  })

  it("does not draw dot-grid for a plain mesh theme", () => {
    const r = createRecorder()
    drawKineticBackground(r.ctx, preset("ocean"), 0)
    expect(r.arcs).toBe(0)
  })
})

describe("nature scenes", () => {
  it("draws stroked streaks for rain", () => {
    const r = createRecorder()
    const drew = drawKineticBackground(r.ctx, preset("nature-rain"), 0)
    expect(drew).toBe(true)
    expect(r.paths).toBeGreaterThan(0)
  })

  it("draws flake arcs for snow", () => {
    const r = createRecorder()
    drawKineticBackground(r.ctx, preset("nature-snow"), 0)
    expect(r.arcs).toBeGreaterThan(0)
  })

  it("draws glow arcs for fireflies", () => {
    const r = createRecorder()
    drawKineticBackground(r.ctx, preset("nature-fireflies"), 0)
    expect(r.arcs).toBeGreaterThan(0)
  })

  it("draws leaf polygons for foliage", () => {
    const r = createRecorder()
    drawKineticBackground(r.ctx, preset("nature-foliage"), 0)
    expect(r.paths).toBeGreaterThan(0)
  })

  it("is deterministic at a fixed timeMs and animates as time advances", () => {
    const a = createRecorder()
    const b = createRecorder()
    const c = createRecorder()
    drawKineticBackground(a.ctx, preset("nature-snow"), 0)
    drawKineticBackground(b.ctx, preset("nature-snow"), 0)
    drawKineticBackground(c.ctx, preset("nature-snow"), 1500)
    expect(a.arcArgs).toEqual(b.arcArgs)
    expect(a.arcArgs).not.toEqual(c.arcArgs)
  })
})
