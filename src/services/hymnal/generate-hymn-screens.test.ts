import { describe, expect, it } from "vitest"
import { generateHymnScreens } from "./generate-hymn-screens"
import { getHymnByNumber, searchHymns } from "./hymnal-repository"
import type { Hymn } from "@/types"

function makeHymn(sections: Hymn["sections"]): Hymn {
  return {
    id: "test-hymn",
    number: 99,
    title: "Test Hymn",
    sections,
  }
}

describe("hymnal services", () => {
  it("loads the generated SDA hymnal data", async () => {
    const hymn = await getHymnByNumber(1)

    expect(hymn).toMatchObject({
      number: 1,
      title: "Praise to the Lord",
    })
    expect(hymn?.sections.length).toBeGreaterThan(0)
  })

  it("searches hymns by number and title", () => {
    expect(searchHymns("1", 1)[0]).toMatchObject({ number: 1 })
    expect(searchHymns("Praise to the Lord", 1)[0]).toMatchObject({ number: 1 })
  })

  it("splits long stanzas across multiple screens", () => {
    const hymn = makeHymn([
      {
        id: "v1",
        kind: "verse",
        label: "Verse 1",
        number: 1,
        lines: [
          "Line one",
          "Line two",
          "Line three",
          "Line four",
          "Line five",
          "Line six",
        ],
      },
    ])

    const screens = generateHymnScreens({
      hymn,
      selectedSectionIds: ["v1"],
    })

    expect(screens.length).toBeGreaterThan(1)
    expect(screens[0]).toMatchObject({
      hymnNumber: 99,
      sectionLabel: "Verse 1",
      sectionScreenIndex: 0,
      sectionScreenCount: screens.length,
    })
    expect(screens.every((screen) => screen.lines.length <= 4)).toBe(true)
    expect(screens.flatMap((screen) => screen.lines)).toEqual(hymn.sections[0].lines)
  })

  it("preserves verse and refrain order from selected sections", () => {
    const hymn = makeHymn([
      {
        id: "v1",
        kind: "verse",
        label: "Verse 1",
        number: 1,
        lines: ["Stanza one line"],
      },
      {
        id: "r1",
        kind: "refrain",
        label: "Refrain",
        afterVerseNumber: 1,
        lines: ["Refrain line"],
      },
      {
        id: "v2",
        kind: "verse",
        label: "Verse 2",
        number: 2,
        lines: ["Stanza two line"],
      },
      {
        id: "r2",
        kind: "refrain",
        label: "Refrain",
        afterVerseNumber: 2,
        lines: ["Refrain line"],
      },
    ])

    const screens = generateHymnScreens({
      hymn,
      selectedSectionIds: ["v1", "r1", "v2", "r2"],
    })

    expect(screens).toHaveLength(4)
    expect(screens.map((screen) => screen.sectionKind)).toEqual([
      "verse",
      "refrain",
      "verse",
      "refrain",
    ])
    expect(screens.map((screen) => screen.sectionLabel)).toEqual([
      "Verse 1",
      "Refrain",
      "Verse 2",
      "Refrain",
    ])
  })

  it("preserves repeated hymn sections as separate screens", async () => {
    const hymn = await getHymnByNumber(1)
    expect(hymn).not.toBeNull()

    const sectionId = hymn!.sections[0].id
    const screens = generateHymnScreens({
      hymn: hymn!,
      selectedSectionIds: [sectionId, sectionId],
    })

    expect(screens).toHaveLength(2)
    expect(screens.map((screen) => screen.id)).toEqual([
      `${sectionId}-repeat-1-screen-1`,
      `${sectionId}-repeat-2-screen-1`,
    ])
    expect(screens.every((screen) => screen.sectionScreenCount === 1)).toBe(true)
  })
})
