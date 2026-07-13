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

function loadEducation(): EgwSource {
  return JSON.parse(
    readFileSync(
      join(import.meta.dir, "sources", "egw", "education.json"),
      "utf-8"
    )
  ) as EgwSource
}

describe("Education source", () => {
  test("chapter 1 follows the PDF folio pages on canonical EGW Writings paragraph boundaries", () => {
    // Paragraph boundaries: https://m.egwwritings.org/en/book/29.29#29.
    // Page labels come from the supplied PDF folios, whose TOC starts chapter 1
    // at page 8 instead of the EGW Writings Ed 13 citation label.
    const expectedLabels = [
      "8.1",
      "8.2",
      "8.3",
      "8.4",
      "8.5",
      "9.1",
      "9.2",
      "9.3",
      "9.4",
      "10.1",
      "10.2",
      "10.3",
      "10.4",
      "11.1",
      "11.2",
      "11.3",
      "12.1",
      "12.2",
      "12.3",
      "12.4",
      "12.5",
      "12.6",
      "12.7",
      "12.8",
      "12.9",
      "12.10",
    ]

    const source = loadEducation()
    const chapter1 = source.chapters.find((entry) => entry.chapter === 1)

    expect(source.chapters).toHaveLength(35)
    expect(
      chapter1?.paragraphs.map((p) => `${p.page}.${p.page_paragraph}`)
    ).toEqual(expectedLabels)
    expect(chapter1?.paragraphs).toHaveLength(26)
  })

  test("keeps chapter 1 visible-site paragraph boundaries", () => {
    const source = loadEducation()
    const chapter1 = source.chapters.find((entry) => entry.chapter === 1)

    expect(chapter1?.paragraphs[0]?.text).toContain("The knowledge of the holy")
    expect(chapter1?.paragraphs[4]?.page).toBe(8)
    expect(chapter1?.paragraphs[4]?.page_paragraph).toBe(5)
    expect(chapter1?.paragraphs[16]?.text).toBe(
      "What education can be higher than this? What can equal it in value?"
    )
    expect(chapter1?.paragraphs[25]?.text).toMatch(
      /^He who co-operates with the divine purpose/
    )
  })

  test("keeps chapter 6 page-break continuation inside the canonical paragraph", () => {
    // Source: https://m.egwwritings.org/en/book/29.181#181. Ed 47.2 keeps
    // this text in one paragraph even though the supplied PDF crosses a folio.
    const source = loadEducation()
    const chapter6 = source.chapters.find((entry) => entry.chapter === 6)
    const paragraph = chapter6?.paragraphs[5]

    expect(
      source.chapters.reduce(
        (count, chapter) => count + chapter.paragraphs.length,
        0
      )
    ).toBe(1310)
    expect(chapter6?.paragraphs).toHaveLength(16)
    expect(paragraph?.page).toBe(34)
    expect(paragraph?.page_paragraph).toBe(3)
    expect(paragraph?.text).toContain(
      "Sanctified intellect brought forth from the treasure house of God things new and old"
    )
  })

  test("uses the supplied PDF folio pages for chapter starts", () => {
    const source = loadEducation()
    const expectedStartPages = new Map([
      [1, 8],
      [2, 13],
      [3, 15],
      [4, 19],
      [5, 24],
      [6, 33],
      [7, 38],
      [8, 54],
      [9, 62],
      [10, 74],
      [11, 77],
      [12, 85],
      [13, 92],
      [14, 96],
      [15, 102],
      [16, 111],
      [17, 122],
      [18, 132],
      [19, 135],
      [20, 145],
    ])

    expect(source.chapters).toHaveLength(35)

    for (const [chapter, expectedPage] of expectedStartPages) {
      const entry = source.chapters.find(
        (candidate) => candidate.chapter === chapter
      )
      expect(entry?.paragraphs[0]?.page).toBe(expectedPage)
    }
  })
})
