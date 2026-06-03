import type { Hymn, HymnScreen } from "@/types"

export interface GenerateHymnScreensOptions {
  hymn: Hymn
  selectedSectionIds: string[]
  /** @deprecated Ignored — each hymn section is always one screen. */
  maxLinesPerScreen?: number
}

export function generateHymnScreens({
  hymn,
  selectedSectionIds,
}: GenerateHymnScreensOptions): HymnScreen[] {
  const screens: HymnScreen[] = []
  const sectionsById = new Map(hymn.sections.map((section) => [section.id, section]))
  const occurrenceBySectionId = new Map<string, number>()

  for (const sectionId of selectedSectionIds) {
    const section = sectionsById.get(sectionId)
    if (!section) continue
    const occurrence = (occurrenceBySectionId.get(section.id) ?? 0) + 1
    occurrenceBySectionId.set(section.id, occurrence)

    screens.push({
      id: `${section.id}-repeat-${occurrence}-screen-1`,
      hymnId: hymn.id,
      hymnNumber: hymn.number,
      hymnTitle: hymn.title,
      sectionId: section.id,
      sectionLabel: section.label,
      sectionKind: section.kind,
      screenIndex: screens.length,
      sectionScreenIndex: 0,
      sectionScreenCount: 1,
      totalScreens: 0,
      lines: [...section.lines],
    })
  }

  return screens.map((screen) => ({
    ...screen,
    totalScreens: screens.length,
  }))
}
