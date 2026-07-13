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
      "utf-8",
    ),
  ) as EgwSource
}

describe("The Great Controversy source", () => {
  test("chapter 1 follows the canonical EGW Writings GC paragraph labels", () => {
    // Source: https://m.egwwritings.org/en/book/132.69#69. The visible GC
    // labels are the canonical paragraph boundaries; the PDF supplies pages.
    const expectedLabels = [
      "17.1",
      "17.2",
      "18.1",
      "18.2",
      "19.1",
      "19.2",
      "20.1",
      "20.2",
      "20.3",
      "21.1",
      "21.2",
      "22.1",
      "22.2",
      "23.1",
      "23.2",
      "23.3",
      "24.1",
      "24.2",
      "24.3",
      "25.1",
      "25.2",
      "25.3",
      "25.4",
      "26.1",
      "26.2",
      "27.1",
      "27.2",
      "27.3",
      "28.1",
      "29.1",
      "29.2",
      "29.3",
      "30.1",
      "30.2",
      "31.1",
      "31.2",
      "32.1",
      "32.2",
      "32.3",
      "33.1",
      "33.2",
      "34.1",
      "34.2",
      "35.1",
      "35.2",
      "36.1",
      "36.2",
      "37.1",
      "37.2",
      "38.1",
    ]

    const source = loadGreatControversy()
    const chapter1 = source.chapters.find((entry) => entry.chapter === 1)

    expect(source.chapters).toHaveLength(42)
    expect(chapter1?.paragraphs.map((p) => `${p.page}.${p.page_paragraph}`))
      .toEqual(expectedLabels)
    expect(chapter1?.paragraphs).toHaveLength(50)
  })

  test("keeps chapter 1 visible-site paragraph boundaries", () => {
    const source = loadGreatControversy()
    const chapter1 = source.chapters.find((entry) => entry.chapter === 1)

    expect(chapter1?.paragraphs[1]?.text).toContain(
      "thousands of voices declared Him king",
    )
    expect(chapter1?.paragraphs[2]?.text).toMatch(/^His tears/)
    expect(chapter1?.paragraphs[45]?.page).toBe(36)
    expect(chapter1?.paragraphs[45]?.page_paragraph).toBe(1)
    expect(chapter1?.paragraphs[49]?.text).toMatch(/^The world is no more ready/)
  })
})
