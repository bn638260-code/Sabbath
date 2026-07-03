import { describe, expect, it, vi } from "vitest"
import { drawVerseText } from "./verse-draw"
import { computeVerseLayoutMetrics } from "./verse-layout"
import { BUILTIN_THEMES } from "./builtin-themes"
import type { BroadcastTheme, VerseRenderData } from "@/types"

function mockCtx() {
  const fonts: string[] = []
  let currentFont = ""
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    get font() {
      return currentFont
    },
    set font(v: string) {
      currentFont = v
      fonts.push(v)
    },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    textBaseline: "top",
    textAlign: "left",
    letterSpacing: "0px",
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn((s: string) => ({ width: s.length * 10 })),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D
  return { ctx, fonts }
}

const verse: VerseRenderData = {
  reference: "John 3:16",
  segments: [{ text: "For God so loved the world" }],
}

describe("drawVerseText fontStyle", () => {
  it("prefixes 'italic' when verseText.fontStyle is italic", () => {
    const { ctx, fonts } = mockCtx()
    const base = BUILTIN_THEMES[0]
    const theme: BroadcastTheme = {
      ...base,
      verseText: { ...base.verseText, fontStyle: "italic" },
    }
    drawVerseText(ctx, theme, verse, 0, 800, 0)
    expect(fonts.some((f) => f.startsWith("italic "))).toBe(true)
  })

  it("leaves the font string unchanged when fontStyle is absent", () => {
    const { ctx, fonts } = mockCtx()
    drawVerseText(ctx, BUILTIN_THEMES[0], verse, 0, 800, 0)
    expect(fonts.length).toBeGreaterThan(0)
    expect(fonts.every((f) => !f.includes("italic"))).toBe(true)
  })

  it("measures layout with the same italic font string it draws", () => {
    const { ctx, fonts } = mockCtx()
    const base = BUILTIN_THEMES[0]
    const theme: BroadcastTheme = {
      ...base,
      verseText: { ...base.verseText, fontStyle: "italic" },
    }
    computeVerseLayoutMetrics(ctx, theme, verse)
    expect(fonts.some((f) => f.startsWith("italic "))).toBe(true)
  })
})
