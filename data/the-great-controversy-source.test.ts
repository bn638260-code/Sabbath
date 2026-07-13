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

function loadGreatControversy(): EgwSource {
  return JSON.parse(
    readFileSync(
      join(import.meta.dir, "sources", "egw", "the-great-controversy.json"),
      "utf-8"
    )
  ) as EgwSource
}

describe("The Great Controversy source", () => {
  test("chapter 1 follows the canonical EGW Writings GC paragraph labels", () => {
    // Source: https://m.egwwritings.org/en/book/132.69#69. The visible GC
    // labels are the canonical paragraph boundaries; the PDF supplies pages.
    const expectedLabels = [
      "14.1",
      "14.2",
      "15.1",
      "15.2",
      "16.1",
      "16.2",
      "16.3",
      "16.4",
      "17.1",
      "17.2",
      "17.3",
      "18.1",
      "18.2",
      "19.1",
      "19.2",
      "19.3",
      "19.4",
      "20.1",
      "20.2",
      "20.3",
      "20.4",
      "21.1",
      "21.2",
      "21.3",
      "22.1",
      "22.2",
      "22.3",
      "22.4",
      "23.1",
      "24.1",
      "24.2",
      "24.3",
      "24.4",
      "25.1",
      "25.2",
      "26.1",
      "26.2",
      "27.1",
      "27.2",
      "27.3",
      "28.1",
      "28.2",
      "29.1",
      "29.2",
      "29.3",
      "29.4",
      "30.1",
      "30.2",
      "31.1",
      "31.2",
    ]

    const source = loadGreatControversy()
    const chapter1 = source.chapters.find((entry) => entry.chapter === 1)

    expect(source.chapters).toHaveLength(42)
    expect(
      chapter1?.paragraphs.map((p) => `${p.page}.${p.page_paragraph}`)
    ).toEqual(expectedLabels)
    expect(chapter1?.paragraphs).toHaveLength(50)
  })

  test("keeps chapter 1 visible-site paragraph boundaries", () => {
    const source = loadGreatControversy()
    const chapter1 = source.chapters.find((entry) => entry.chapter === 1)

    expect(chapter1?.paragraphs[1]?.text).toContain(
      "thousands of voices declared Him king"
    )
    expect(chapter1?.paragraphs[2]?.text).toMatch(/^His tears/)
    expect(chapter1?.paragraphs[45]?.page).toBe(29)
    expect(chapter1?.paragraphs[45]?.page_paragraph).toBe(4)
    expect(chapter1?.paragraphs[49]?.text).toMatch(
      /^The world is no more ready/
    )
  })

  test("uses the supplied PDF folio pages for chapter starts", () => {
    const source = loadGreatControversy()
    const expectedStartPages = new Map([
      [1, 14],
      [2, 32],
      [3, 40],
      [4, 51],
      [5, 66],
      [6, 81],
      [7, 101],
      [8, 122],
      [9, 144],
      [10, 156],
      [11, 167],
      [12, 179],
      [13, 202],
      [14, 209],
      [15, 226],
      [16, 247],
      [17, 256],
      [18, 271],
      [19, 293],
      [20, 303],
    ])

    for (const [chapter, expectedPage] of expectedStartPages) {
      const entry = source.chapters.find(
        (candidate) => candidate.chapter === chapter
      )
      expect(entry?.paragraphs[0]?.page).toBe(expectedPage)
    }
  })
})
