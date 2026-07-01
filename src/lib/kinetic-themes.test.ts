import { describe, expect, it } from "vitest"
import {
  KINETIC_THEME_PRESETS,
  KINETIC_THEME_IDS,
  buildKineticBroadcastThemes,
  kineticThemeId,
} from "./kinetic-themes"

const EXPECTED_PRESET_IDS = [
  // classical serif group
  "ocean",
  "cathedral",
  "monastery",
  "renaissance",
  "celestial",
  "editorial",
  "parchment",
  "royal",
  // modern geometric group
  "cyberpunk",
  "nordic",
  "stark",
  "sunset",
  "brutalist",
  "lime",
  // nature scene group
  "nature-foliage",
  "nature-forest",
  "nature-rain",
  "nature-autumn",
  "nature-blossom",
  "nature-snow",
  "nature-fireflies",
  "nature-stars",
  "nature-meadow",
  "nature-aurora",
]

describe("KINETIC_THEME_PRESETS", () => {
  it("contains exactly 24 presets with the expected ids", () => {
    expect(KINETIC_THEME_PRESETS).toHaveLength(24)
    expect(KINETIC_THEME_PRESETS.map((p) => p.presetId)).toEqual(
      EXPECTED_PRESET_IDS,
    )
  })

  it("has eight classical, six modern and ten nature presets", () => {
    const classical = KINETIC_THEME_PRESETS.filter((p) => p.group === "classical")
    const modern = KINETIC_THEME_PRESETS.filter((p) => p.group === "modern")
    const nature = KINETIC_THEME_PRESETS.filter((p) => p.group === "nature")
    expect(classical).toHaveLength(8)
    expect(modern).toHaveLength(6)
    expect(nature).toHaveLength(10)
  })

  it("gives cyberpunk a dot-grid and brutalist diagonal stripes", () => {
    const cyber = KINETIC_THEME_PRESETS.find((p) => p.presetId === "cyberpunk")
    const brut = KINETIC_THEME_PRESETS.find((p) => p.presetId === "brutalist")
    expect(cyber?.backgroundKind).toBe("grid")
    expect(cyber?.pattern).toBe("dot-grid")
    expect(brut?.backgroundKind).toBe("stripes")
    expect(brut?.pattern).toBe("diagonal-stripes")
  })

  it("every preset declares at least two mesh colors and an accent", () => {
    for (const preset of KINETIC_THEME_PRESETS) {
      expect(preset.colors.length).toBeGreaterThanOrEqual(2)
      expect(preset.accentColor).toMatch(/^#/)
      expect(preset.motion.durationMs).toBeGreaterThan(0)
    }
  })
})

describe("buildKineticBroadcastThemes", () => {
  const themes = buildKineticBroadcastThemes()

  it("produces one builtin BroadcastTheme per preset", () => {
    expect(themes).toHaveLength(24)
    for (const theme of themes) {
      expect(theme.builtin).toBe(true)
      expect(theme.kinetic).toBeDefined()
      expect(theme.kinetic?.source).toBe("html-prototype-v2")
    }
  })

  it("uses the stable kinetic id scheme", () => {
    expect(themes[0].id).toBe(kineticThemeId("ocean"))
    expect(kineticThemeId("ocean")).toBe("builtin-kinetic-ocean")
    expect(themes.map((t) => t.id)).toEqual(KINETIC_THEME_IDS)
  })

  it("falls back to a gradient/solid background so static draw still works", () => {
    for (const theme of themes) {
      expect(["gradient", "solid"]).toContain(theme.background.type)
    }
  })

  it("does not reference network fonts", () => {
    const allowed = new Set([
      "Source Serif 4 Variable",
      "DM Serif Display",
      "Geist Variable",
      "Source Sans 3 Variable",
      "Cinzel",
      "Playfair Display",
      "Bebas Neue",
    ])
    for (const theme of themes) {
      expect(allowed.has(theme.verseText.fontFamily)).toBe(true)
    }
  })
})
