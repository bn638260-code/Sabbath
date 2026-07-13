import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "bun:test"

type EgwSource = {
  title: string
  abbreviation: string
  chapters: Array<{
    chapter: number
    title: string
    paragraphs: Array<{
      paragraph: number
      page: number
      page_paragraph: number
      text: string
    }>
  }>
}

function loadDesireOfAges(): EgwSource {
  return JSON.parse(
    readFileSync(
      join(import.meta.dir, "sources", "egw", "the-desire-of-ages.json"),
      "utf-8",
    ),
  ) as EgwSource
}

describe("The Desire of Ages source", () => {
  test("chapter 1 follows the canonical EGW Writings DA paragraph labels", () => {
    // Source: https://m.egwwritings.org/en/book/130.21#21. The visible DA
    // labels are the canonical paragraph boundaries; the PDF supplies pages.
    const expectedLabels = [
      "19.1",
      "19.2",
      "20.1",
      "20.2",
      "21.1",
      "21.2",
      "21.3",
      "22.1",
      "22.2",
      "22.3",
      "22.4",
      "23.1",
      "23.2",
      "23.3",
      "24.1",
      "24.2",
      "24.3",
      "25.1",
      "25.2",
      "25.3",
      "26.1",
      "26.2",
      "26.3",
    ]

    const source = loadDesireOfAges()
    const chapter1 = source.chapters.find((entry) => entry.chapter === 1)

    expect(source.chapters).toHaveLength(87)
    expect(chapter1?.paragraphs.map((p) => `${p.page}.${p.page_paragraph}`))
      .toEqual(expectedLabels)
    expect(chapter1?.paragraphs).toHaveLength(23)
  })

  test("keeps chapter 1 visible-site paragraph boundaries", () => {
    const source = loadDesireOfAges()
    const chapter1 = source.chapters.find((entry) => entry.chapter === 1)

    expect(chapter1?.paragraphs[2]?.text).toContain("earth with beauty")
    expect(chapter1?.paragraphs[2]?.text).not.toContain("9 earth")
    expect(chapter1?.paragraphs[22]?.page).toBe(26)
    expect(chapter1?.paragraphs[22]?.page_paragraph).toBe(3)
    expect(chapter1?.paragraphs[22]?.text).toContain('Immanuel, "God with us"')
  })
})
