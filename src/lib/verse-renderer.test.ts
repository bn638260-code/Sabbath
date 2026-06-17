import { describe, expect, it } from "vitest"
import { clampCornerRadius, textForPresentation } from "./verse-renderer"
import type { PresentationRenderData, VerseRenderData } from "@/types"

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
})

describe("clampCornerRadius", () => {
  it("keeps rounded rectangles inside half the smallest dimension", () => {
    expect(clampCornerRadius(100, 20, 80)).toBe(10)
  })

  it("does not allow negative radii", () => {
    expect(clampCornerRadius(100, 20, -4)).toBe(0)
  })
})
