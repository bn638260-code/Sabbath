import { describe, expect, it, vi } from "vitest"
import { BUILTIN_THEMES } from "./builtin-themes"
import { clampCornerRadius, renderPresentation, textForPresentation } from "./verse-renderer"
import type { BroadcastTheme, PresentationRenderData, VerseRenderData } from "@/types"

describe("textForPresentation", () => {
  it("flows chunked scripture as one continuous paragraph", () => {
    // Regression: long verses are split into readability chunks; rendering
    // those chunks as blank-line-separated paragraphs produced uneven text
    // blocks with large gaps on the projected slide (e.g. Genesis 8:9).
    const verse: VerseRenderData = {
      reference: "Genesis 8:9 (KJV)",
      segments: [
        { verseNumber: 9, text: "But the dove found no rest for the sole of her foot," },
        { text: "for the waters were on the face of the whole earth:" },
        { text: "and pulled her in unto him into the ark." },
      ],
    }

    const text = textForPresentation(verse, true)
    expect(text).not.toContain("\n")
    expect(text).toBe(
      "9 But the dove found no rest for the sole of her foot, " +
        "for the waters were on the face of the whole earth: " +
        "and pulled her in unto him into the ark.",
    )
  })

  it("omits verse numbers when disabled", () => {
    const verse: VerseRenderData = {
      reference: "John 3:16 (KJV)",
      segments: [{ verseNumber: 16, text: "For God so loved the world" }],
    }
    expect(textForPresentation(verse, false)).toBe("For God so loved the world")
  })

  it("keeps hymn lyric lines on separate lines", () => {
    const hymn = {
      kind: "hymn",
      reference: "Hymn 250",
      segments: [{ text: "Amazing grace" }, { text: "how sweet the sound" }],
    } as unknown as PresentationRenderData

    expect(textForPresentation(hymn, false)).toBe(
      "Amazing grace\nhow sweet the sound",
    )
  })

  it("keeps EGW slide segments on separate lines", () => {
    const egw = {
      kind: "egw",
      reference: "Steps to Christ 1:1",
      segments: [{ text: "Nature and revelation alike testify" }],
    } as unknown as PresentationRenderData

    expect(textForPresentation(egw, false)).toBe(
      "Nature and revelation alike testify",
    )
  })

  it("keeps themed slide-deck text lines separate", () => {
    const slide = {
      kind: "slideDeck",
      reference: "Theme title",
      segments: [{ text: "First point" }, { text: "- Bullet" }],
    } as unknown as PresentationRenderData

    expect(textForPresentation(slide, false)).toBe("First point\n- Bullet")
  })
})

describe("clampCornerRadius", () => {
  it("keeps rounded rectangles inside half the smallest dimension", () => {
    expect(clampCornerRadius(100, 20, 80)).toBe(10)
  })

  it("does not allow negative radii", () => {
    expect(clampCornerRadius(100, 20, -4)).toBe(0)
  })
})

describe("renderPresentation slide deck images", () => {
  it("draws themed slide images inside the theme text area", () => {
    const { context, drawImage } = createRenderContext()
    const theme = testTheme()
    const imageUrl = "data:image/png;base64,slide"
    const image = {
      naturalWidth: 2000,
      naturalHeight: 1000,
    } as HTMLImageElement

    renderPresentation(
      context,
      theme,
      {
        kind: "slideDeck",
        reference: "Slide",
        segments: [{ text: "Slide" }],
        slideImageUrl: imageUrl,
        applyTheme: true,
        hymnSlide: {
          screenId: "slide-1",
          slideIndex: 0,
          slideCount: 1,
        },
      },
      { imageCache: new Map([[imageUrl, image]]) }
    )

    expect(drawImage).toHaveBeenCalledWith(image, 250, 375, 500, 250)
  })
})

function testTheme(): BroadcastTheme {
  return {
    ...BUILTIN_THEMES[0],
    resolution: { width: 1000, height: 1000 },
    background: {
      type: "solid",
      color: "#101010",
      gradient: null,
      image: null,
    },
    textBox: {
      ...BUILTIN_THEMES[0].textBox,
      enabled: false,
    },
    layout: {
      ...BUILTIN_THEMES[0].layout,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      textAreaWidth: 50,
      textAreaHeight: 50,
    },
  }
}

function createRenderContext(): {
  context: CanvasRenderingContext2D
  drawImage: ReturnType<typeof vi.fn>
} {
  const drawImage = vi.fn()
  const gradient = { addColorStop: vi.fn() }
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    drawImage,
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
  } as unknown as CanvasRenderingContext2D
  return { context, drawImage }
}
