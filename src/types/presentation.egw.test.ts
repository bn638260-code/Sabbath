import { describe, it, expect } from "vitest"
import { getPresentationRenderData } from "./presentation"
import type { EgwPresentationItemData } from "./presentation"

describe("EGW presentation render data", () => {
  it("maps an EGW item to reference + segments", () => {
    const item: EgwPresentationItemData = {
      kind: "egw",
      paragraph: {
        id: 1,
        book_number: 1,
        book_title: "Patriarchs and Prophets",
        chapter: 1,
        chapter_title: "Why Was Sin Permitted?",
        paragraph: 3,
        text: "God is love.",
      },
      reference: "Patriarchs and Prophets 1:3",
      segments: [{ text: "God is love." }],
    }
    const render = getPresentationRenderData(item)
    expect(render.kind).toBe("egw")
    expect(render.reference).toBe("Patriarchs and Prophets 1:3")
    expect(render.segments).toEqual([{ text: "God is love." }])
  })
})