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
      "utf-8"
    )
  ) as EgwSource
}

describe("The Desire of Ages source", () => {
  test("chapter 1 follows the PDF folio pages on canonical EGW Writings paragraph boundaries", () => {
    // Paragraph boundaries: https://m.egwwritings.org/en/book/130.21#21.
    // Page labels come from the supplied PDF folios, whose TOC starts chapter 1
    // at page 9 instead of the EGW Writings DA 19 citation label.
    const expectedLabels = [
      "9.1",
      "9.2",
      "9.3",
      "10.1",
      "10.2",
      "10.3",
      "10.4",
      "11.1",
      "11.2",
      "11.3",
      "11.4",
      "12.1",
      "12.2",
      "12.3",
      "13.1",
      "13.2",
      "13.3",
      "14.1",
      "14.2",
      "14.3",
      "15.1",
      "15.2",
      "15.3",
    ]

    const source = loadDesireOfAges()
    const chapter1 = source.chapters.find((entry) => entry.chapter === 1)

    expect(source.chapters).toHaveLength(87)
    expect(
      chapter1?.paragraphs.map((p) => `${p.page}.${p.page_paragraph}`)
    ).toEqual(expectedLabels)
    expect(chapter1?.paragraphs).toHaveLength(23)
  })

  test("keeps chapter 1 visible-site paragraph boundaries", () => {
    const source = loadDesireOfAges()
    const chapter1 = source.chapters.find((entry) => entry.chapter === 1)

    expect(chapter1?.paragraphs[2]?.text).toContain("earth with beauty")
    expect(chapter1?.paragraphs[2]?.text).not.toContain("9 earth")
    expect(chapter1?.paragraphs[22]?.page).toBe(15)
    expect(chapter1?.paragraphs[22]?.page_paragraph).toBe(3)
    expect(chapter1?.paragraphs[22]?.text).toContain('Immanuel, "God with us"')
  })

  test("uses the supplied PDF folio pages for chapter starts", () => {
    const source = loadDesireOfAges()
    const expectedStartPages = new Map([
      [1, 9],
      [2, 16],
      [3, 20],
      [4, 26],
      [5, 31],
      [6, 38],
      [7, 45],
      [8, 52],
      [9, 60],
      [10, 67],
      [11, 79],
      [12, 84],
      [13, 94],
      [14, 100],
      [15, 111],
      [16, 120],
      [17, 131],
      [18, 140],
      [19, 144],
      [20, 155],
    ])

    for (const [chapter, expectedPage] of expectedStartPages) {
      const entry = source.chapters.find(
        (candidate) => candidate.chapter === chapter
      )
      expect(entry?.paragraphs[0]?.page).toBe(expectedPage)
    }
  })
})
