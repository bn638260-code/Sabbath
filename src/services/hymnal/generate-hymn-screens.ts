import type { Hymn, HymnScreen } from "@/types"

export interface GenerateHymnScreensOptions {
  hymn: Hymn
  selectedSectionIds: string[]
  maxLinesPerScreen?: number
}

function splitSectionLines(lines: string[], maxLinesPerScreen: number): string[][] {
  const normalizedLimit = Math.max(1, maxLinesPerScreen)
  const screens: string[][] = []

  for (let index = 0; index < lines.length; index += normalizedLimit) {
    screens.push(lines.slice(index, index + normalizedLimit))
  }

  return screens.length > 0 ? screens : [[]]
}

export function generateHymnScreens({
  hymn,
  selectedSectionIds,
  maxLinesPerScreen = 4,
}: GenerateHymnScreensOptions): HymnScreen[] {
  const screens: HymnScreen[] = []
  const sectionsById = new Map(hymn.sections.map((section) => [section.id, section]))
  const occurrenceBySectionId = new Map<string, number>()

  for (const sectionId of selectedSectionIds) {
    const section = sectionsById.get(sectionId)
    if (!section) continue
    const occurrence = (occurrenceBySectionId.get(section.id) ?? 0) + 1
    occurrenceBySectionId.set(section.id, occurrence)
    const sectionScreens = splitSectionLines(section.lines, maxLinesPerScreen)

    sectionScreens.forEach((screenLines, sectionScreenIndex) => {
      screens.push({
        id: `${section.id}-repeat-${occurrence}-screen-${sectionScreenIndex + 1}`,
        hymnId: hymn.id,
        hymnNumber: hymn.number,
        hymnTitle: hymn.title,
        sectionId: section.id,
        sectionLabel: section.label,
        sectionKind: section.kind,
        screenIndex: screens.length,
        sectionScreenIndex,
        sectionScreenCount: sectionScreens.length,
        totalScreens: 0,
        lines: [...screenLines],
      })
    })
  }

  return screens.map((screen) => ({
    ...screen,
    totalScreens: screens.length,
  }))
}
