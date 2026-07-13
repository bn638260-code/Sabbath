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
      "utf-8",
    ),
  ) as EgwSource
}

describe("Patriarchs and Prophets source", () => {
  test("chapter 1 follows the canonical EGW Writings PP paragraph labels", () => {
    // Source: https://m.egwwritings.org/en/book/84.68#68. The visible PP
    // labels are the canonical paragraph boundaries; the PDF supplies pages.
    const expectedLabels = [
      "33.1",
      "33.2",
      "33.3",
      "33.4",
      "34.1",
      "34.2",
      "34.3",
      "35.1",
      "35.2",
      "35.3",
      "36.1",
      "36.2",
      "36.3",
      "37.1",
      "38.1",
      "38.2",
      "38.3",
      "39.1",
      "39.2",
      "40.1",
      "40.2",
      "40.3",
      "41.1",
      "41.2",
      "41.3",
      "42.1",
      "42.2",
      "42.3",
      "42.4",
      "43.1",
    ]

    const source = loadPatriarchsAndProphets()
    const chapter1 = source.chapters.find((entry) => entry.chapter === 1)

    expect(source.chapters).toHaveLength(73)
    expect(chapter1?.paragraphs.map((p) => `${p.page}.${p.page_paragraph}`))
      .toEqual(expectedLabels)
    expect(chapter1?.paragraphs).toHaveLength(30)
  })

  test("keeps chapter 1 visible-site paragraph boundaries", () => {
    const source = loadPatriarchsAndProphets()
    const chapter1 = source.chapters.find((entry) => entry.chapter === 1)

    expect(chapter1?.paragraphs[2]?.text).toContain("Psalm 89:13-18")
    expect(chapter1?.paragraphs[2]?.text).toContain("American Supplement")
    expect(chapter1?.paragraphs[3]?.text).toMatch(
      /^The history of the great conflict/,
    )
    expect(chapter1?.paragraphs[7]?.page).toBe(35)
    expect(chapter1?.paragraphs[7]?.page_paragraph).toBe(1)
    expect(chapter1?.paragraphs[29]?.page).toBe(43)
    expect(chapter1?.paragraphs[29]?.page_paragraph).toBe(1)
  })
})
