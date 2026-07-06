import { describe, expect, it, vi } from "vitest"
import { BUILTIN_THEMES } from "@/lib/builtin-themes"
import { drawHymnSlideCounter } from "@/lib/verse-draw"
import { referenceForPresentation } from "@/lib/verse-layout"
import type { BroadcastTheme, PresentationRenderData } from "@/types"

describe("referenceForPresentation", () => {
  const theme = BUILTIN_THEMES.find((t) => t.id === "builtin-hymn-sanctuary-solid")!

  it("shows the hymn title when titleOnly is enabled", () => {
    const data: PresentationRenderData = {
      kind: "hymn",
      reference: "#12 Joyful, Joyful - Verse 2 of 4",
      hymnTitle: "Joyful, Joyful, We Adore Thee",
      segments: [{ text: "Joyful, joyful" }],
    }
    expect(referenceForPresentation(theme, data)).toBe(
      "Joyful, Joyful, We Adore Thee",
    )
  })

  it("keeps the full reference when titleOnly is off", () => {
    const plainTheme: BroadcastTheme = {
      ...theme,
      hymnPresentation: undefined,
    }
    const data: PresentationRenderData = {
      kind: "hymn",
      reference: "#12 Joyful, Joyful - Verse 2 of 4",
      hymnTitle: "Joyful, Joyful, We Adore Thee",
      segments: [{ text: "Joyful, joyful" }],
    }
    expect(referenceForPresentation(plainTheme, data)).toBe(
      "#12 Joyful, Joyful - Verse 2 of 4",
    )
  })
})

describe("drawHymnSlideCounter sanctuary style", () => {
  it("renders bottom-right slash counter with verse font", () => {
    const theme = BUILTIN_THEMES.find((t) => t.id === "builtin-hymn-sanctuary-solid")!
    const fillText = vi.fn()
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      measureText: vi.fn(() => ({ width: 40 })),
      fillText,
      font: "",
      fillStyle: "",
      textBaseline: "",
      textAlign: "",
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D

    drawHymnSlideCounter(ctx, theme, {
      kind: "hymn",
      reference: "Hymn",
      segments: [{ text: "Line" }],
      hymnSlide: { screenId: "s1", slideIndex: 1, slideCount: 4 },
    })

    expect(fillText).toHaveBeenCalledWith("2/4", expect.any(Number), expect.any(Number))
    expect(ctx.font).toContain("Plus Jakarta Sans Variable")
  })
})
