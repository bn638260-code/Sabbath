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

function loadPatriarchsAndProphets(): EgwSource {
  return JSON.parse(
    readFileSync(
      join(import.meta.dir, "sources", "egw", "patriarchs-and-prophets.json"),
      "utf-8"
    )
  ) as EgwSource
}

describe("Patriarchs and Prophets source", () => {
  test("chapter 1 follows the PDF folio pages on canonical EGW Writings paragraph boundaries", () => {
    // Paragraph boundaries: https://m.egwwritings.org/en/book/84.68#68.
    // Page labels come from the supplied PDF folios, whose TOC starts chapter 1
    // at page 17 instead of the EGW Writings PP 33 citation label.
    const expectedLabels = [
      "17.1",
      "17.2",
      "17.3",
      "17.4",
      "18.1",
      "18.2",
      "18.3",
      "19.1",
      "19.2",
      "19.3",
      "20.1",
      "20.2",
      "20.3",
      "21.1",
      "22.1",
      "22.2",
      "22.3",
      "23.1",
      "23.2",
      "24.1",
      "24.2",
      "24.3",
      "25.1",
      "25.2",
      "25.3",
      "26.1",
      "26.2",
      "26.3",
      "27.1",
      "27.2",
    ]

    const source = loadPatriarchsAndProphets()
    const chapter1 = source.chapters.find((entry) => entry.chapter === 1)

    expect(source.chapters).toHaveLength(73)
    expect(
      chapter1?.paragraphs.map((p) => `${p.page}.${p.page_paragraph}`)
    ).toEqual(expectedLabels)
    expect(chapter1?.paragraphs).toHaveLength(30)
  })

  test("keeps chapter 1 visible-site paragraph boundaries", () => {
    const source = loadPatriarchsAndProphets()
    const chapter1 = source.chapters.find((entry) => entry.chapter === 1)

    expect(chapter1?.paragraphs[2]?.text).toContain("Psalm 89:13-18")
    expect(chapter1?.paragraphs[2]?.text).toContain("American Supplement")
    expect(chapter1?.paragraphs[3]?.text).toMatch(
      /^The history of the great conflict/
    )
    expect(chapter1?.paragraphs[7]?.page).toBe(19)
    expect(chapter1?.paragraphs[7]?.page_paragraph).toBe(1)
    expect(chapter1?.paragraphs[29]?.page).toBe(27)
    expect(chapter1?.paragraphs[29]?.page_paragraph).toBe(2)
  })

  test("uses the supplied PDF folio pages for chapter starts", () => {
    const source = loadPatriarchsAndProphets()
    const expectedStartPages = new Map([
      [1, 17],
      [2, 28],
      [3, 36],
      [4, 47],
      [5, 55],
      [6, 62],
      [7, 72],
      [8, 85],
      [9, 91],
      [10, 97],
      [11, 103],
      [12, 110],
      [13, 123],
      [14, 132],
      [15, 145],
      [16, 151],
      [17, 157],
      [18, 167],
      [19, 174],
      [20, 183],
    ])

    for (const [chapter, expectedPage] of expectedStartPages) {
      const entry = source.chapters.find(
        (candidate) => candidate.chapter === chapter
      )
      expect(entry?.paragraphs[0]?.page).toBe(expectedPage)
    }
  })
})
