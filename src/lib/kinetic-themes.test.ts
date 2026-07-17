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
  // worship scene
  "desert-cloth",
  // KNFC verse-stage group (premium-light mockup)
  "stage-navy",
  "stage-teal",
  "stage-blue",
  "stage-violet",
  "stage-slate",
]

describe("KINETIC_THEME_PRESETS", () => {
  it("contains exactly 30 presets with the expected ids", () => {
    expect(KINETIC_THEME_PRESETS).toHaveLength(30)
    expect(KINETIC_THEME_PRESETS.map((p) => p.presetId)).toEqual(
      EXPECTED_PRESET_IDS,
    )
  })

  it("has fourteen classical, six modern and ten nature presets", () => {
    const classical = KINETIC_THEME_PRESETS.filter((p) => p.group === "classical")
    const modern = KINETIC_THEME_PRESETS.filter((p) => p.group === "modern")
    const nature = KINETIC_THEME_PRESETS.filter((p) => p.group === "nature")
    expect(classical).toHaveLength(14)
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
    expect(themes).toHaveLength(30)
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
      // OS-installed system serif (Desert Cloth) — offline by definition.
      "Georgia",
    ])
    for (const theme of themes) {
      expect(allowed.has(theme.verseText.fontFamily)).toBe(true)
    }
  })
})

describe("desert cloth preset", () => {
  const theme = buildKineticBroadcastThemes().find(
    (t) => t.id === "builtin-kinetic-desert-cloth",
  )

  it("carries the worship design's typography and transition", () => {
    expect(theme).toBeDefined()
    expect(theme?.kinetic?.backgroundKind).toBe("cloth")
    expect(theme?.verseText.fontFamily).toBe("Georgia")
    expect(theme?.verseText.fontStyle).toBe("italic")
    expect(theme?.verseText.color).toBe("#fdf8ee")
    expect(theme?.verseText.shadow?.color).toBe("rgba(61,43,23,0.55)")
    expect(theme?.reference.color).toBe("#f3e8d2")
    expect(theme?.reference.fontSize).toBe(26)
    expect(theme?.reference.letterSpacing).toBe(4)
    expect(theme?.reference.uppercase).toBe(true)
    expect(theme?.reference.position).toBe("below")
    expect(theme?.layout.referenceGap).toBe(40)
    expect(theme?.transition.duration).toBe(1600)
    expect(theme?.kinetic?.motion.hueShiftDegrees).toBe(0)
  })

  it("does not leak its overrides into any other preset", () => {
    for (const t of buildKineticBroadcastThemes()) {
      if (t.id === "builtin-kinetic-desert-cloth") continue
      expect(t.verseText.fontStyle).toBeUndefined()
      expect(t.transition.duration).toBe(500)
      expect(t.reference.uppercase).toBe(true)
    }
  })
})
