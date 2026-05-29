import { describe, expect, it } from "vitest"
import {
  createEgwPresentationItem,
  createEgwQueueItem,
  egwReference,
} from "@/lib/presentation-workflow"
import type { EgwParagraph } from "@/types"

const para: EgwParagraph = {
  id: 7,
  book_number: 1,
  book_title: "Patriarchs and Prophets",
  chapter: 2,
  chapter_title: "The Creation",
  paragraph: 5,
  text: "God is love.",
}

describe("EGW presentation helpers", () => {
  it("formats the reference as title chapter:paragraph", () => {
    expect(egwReference(para)).toBe("Patriarchs and Prophets 2:5")
  })

  it("builds an egw presentation item with one segment", () => {
    const item = createEgwPresentationItem(para)
    expect(item.kind).toBe("egw")
    expect(item.reference).toBe("Patriarchs and Prophets 2:5")
    expect(item.segments).toEqual([{ text: "God is love." }])
    expect(item.paragraph).toBe(para)
  })

  it("builds a manual queue item wrapping the presentation", () => {
    const q = createEgwQueueItem(para)
    expect(q.source).toBe("manual")
    expect(q.confidence).toBe(1)
    expect(q.presentation.kind).toBe("egw")
    expect(typeof q.id).toBe("string")
  })
})
