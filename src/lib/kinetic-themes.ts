import type {
  BroadcastKineticTheme,
  BroadcastTheme,
  KineticBackgroundKind,
  KineticMotion,
  KineticPattern,
} from "@/types/broadcast"

// ---------------------------------------------------------------------------
// Kinetic theme catalog
//
// These 25 presets mirror the moving "Kinetic Theme" selector from the
// SabbathCue HTML prototypes. The first 14 (classical + modern) are canvas-native
// CSS themes: the four mesh-gradient colors, an accent, the motion envelope
// (liquidMesh duration + hue/saturation breathing + drift), and an optional
// overlay pattern (cyberpunk dot-grid, brutalist diagonal stripes). The final 10
// (nature group) are deterministic particle scenes — rain, snow, leaves, petals,
// fireflies, stars, pollen and aurora — drawn from the nature-scenes prototype.
//
// Fonts are mapped to fonts already bundled with the app (no network fonts) so
// the workflow stays fully offline. See the plan's APPROVED FONT APPROACH.
// ---------------------------------------------------------------------------

export interface KineticThemePreset {
  presetId: string
  /** Human label shown in the library (carries the original font intent). */
  name: string
  group: BroadcastKineticTheme["group"]
  backgroundKind: KineticBackgroundKind
  /** Four mesh-gradient corner colors from the prototype. */
  colors: string[]
  accentColor: string
  /** Body/verse text color tuned for readability over the moving base. */
  textColor: string
  /** Local (offline) font family approximating the prototype's font intent. */
  fontFamily: string
  motion: KineticMotion
  pattern?: KineticPattern
}

// Default motion envelope from the prototype: animate-mesh-vigorous is a 6s
// loop, liquidMesh rotates hue up to 25deg and saturates up to 1.3x.
const MESH_MOTION: KineticMotion = {
  durationMs: 6000,
  driftAmount: 0.6,
  hueShiftDegrees: 25,
  saturationBoost: 0.3,
}

// Modern/geometric presets read as more energetic in the prototype.
const MODERN_MOTION: KineticMotion = {
  durationMs: 5200,
  driftAmount: 0.85,
  hueShiftDegrees: 32,
  saturationBoost: 0.4,
}

// Offline font approximations for the prototype's font intents.
const SERIF = "Source Serif 4 Variable"
const DISPLAY_SERIF = "DM Serif Display"
const SANS = "Geist Variable"

// Bundled offline display fonts for the nature scenes (registered in index.css).
const CINZEL = "Cinzel"
const PLAYFAIR = "Playfair Display"
const BEBAS = "Bebas Neue"

// OS-installed serif used by the Desert Cloth worship scene (the HTML design's
// own font). System font: available to canvas offline with no loading step.
const GEORGIA = "Georgia"

// Nature scenes drift slowly and calmly. Particle speed is derived from
// driftAmount in the renderer; the backdrop barely shifts hue so it reads as a
// still scene with motion inside it.
const NATURE_MOTION: KineticMotion = {
  durationMs: 12000,
  driftAmount: 0.5,
  hueShiftDegrees: 6,
  saturationBoost: 0.08,
}

export const KINETIC_THEME_PRESETS: KineticThemePreset[] = [
  // ---- Classical serif group (fluid waves) -------------------------------
  {
    presetId: "ocean",
    name: "Midnight Ocean (Kinetic)",
    group: "classical",
    backgroundKind: "mesh",
    colors: ["#061127", "#112d61", "#030814", "#153878"],
    accentColor: "#38bdf8",
    textColor: "#e0f2fe",
    fontFamily: SERIF,
    motion: MESH_MOTION,
  },
  {
    presetId: "cathedral",
    name: "Cathedral Gold (Kinetic)",
    group: "classical",
    backgroundKind: "mesh",
    colors: ["#110e0c", "#261f1a", "#1a1410", "#2c221b"],
    accentColor: "#d97706",
    textColor: "#fafaf9",
    fontFamily: DISPLAY_SERIF,
    motion: MESH_MOTION,
  },
  {
    presetId: "monastery",
    name: "Sacred Monastery (Kinetic)",
    group: "classical",
    backgroundKind: "mesh",
    colors: ["#070e0b", "#10241b", "#0a1712", "#142e22"],
    accentColor: "#10b981",
    textColor: "#f0fdf4",
    fontFamily: SERIF,
    motion: MESH_MOTION,
  },
  {
    presetId: "renaissance",
    name: "Burgundy Velvet (Kinetic)",
    group: "classical",
    backgroundKind: "mesh",
    colors: ["#3b0211", "#5c071d", "#24010a", "#4a0516"],
    accentColor: "#fb7185",
    textColor: "#ffe4e6",
    fontFamily: DISPLAY_SERIF,
    motion: MESH_MOTION,
  },
  {
    presetId: "celestial",
    name: "Celestial Deep (Kinetic)",
    group: "classical",
    backgroundKind: "mesh",
    colors: ["#0e0a2b", "#2c1654", "#050314", "#361b66"],
    accentColor: "#a855f7",
    textColor: "#faf5ff",
    fontFamily: SERIF,
    motion: MESH_MOTION,
  },
  {
    presetId: "editorial",
    name: "Editorial Canvas (Kinetic)",
    group: "classical",
    backgroundKind: "mesh",
    colors: ["#fbfbfb", "#eae7e4", "#f5f3f0", "#e0ddd9"],
    accentColor: "#57534e",
    textColor: "#1c1917",
    fontFamily: DISPLAY_SERIF,
    motion: MESH_MOTION,
  },
  {
    presetId: "parchment",
    name: "Aged Parchment (Kinetic)",
    group: "classical",
    backgroundKind: "mesh",
    colors: ["#fdfaf2", "#f5ecd6", "#fbf7ea", "#ebe1c5"],
    accentColor: "#92400e",
    textColor: "#451a03",
    fontFamily: SERIF,
    motion: MESH_MOTION,
  },
  {
    presetId: "royal",
    name: "Imperial Purple (Kinetic)",
    group: "classical",
    backgroundKind: "mesh",
    colors: ["#1e0229", "#3d0552", "#100117", "#4c0766"],
    accentColor: "#c084fc",
    textColor: "#fdf4ff",
    fontFamily: SERIF,
    motion: MESH_MOTION,
  },
  // ---- Modern sans / geometric group (active motion) ---------------------
  {
    presetId: "cyberpunk",
    name: "Neon Synthwave (Kinetic)",
    group: "modern",
    backgroundKind: "grid",
    colors: ["#050117", "#240242", "#5a0243", "#15013b"],
    accentColor: "#ec4899",
    textColor: "#ffffff",
    fontFamily: SANS,
    motion: MODERN_MOTION,
    pattern: "dot-grid",
  },
  {
    presetId: "nordic",
    name: "Nordic Frost (Kinetic)",
    group: "modern",
    backgroundKind: "mesh",
    colors: ["#080c14", "#1a253b", "#0d1421", "#223252"],
    accentColor: "#bae6fd",
    textColor: "#f0f9ff",
    fontFamily: SANS,
    motion: MODERN_MOTION,
  },
  {
    presetId: "stark",
    name: "Minimal Stark (Kinetic)",
    group: "modern",
    backgroundKind: "mesh",
    colors: ["#020617", "#0f172a", "#020617", "#1e293b"],
    accentColor: "#64748b",
    textColor: "#cbd5e1",
    fontFamily: SANS,
    motion: { ...MODERN_MOTION, hueShiftDegrees: 8, saturationBoost: 0.12 },
  },
  {
    presetId: "sunset",
    name: "Vibrant Sunset (Kinetic)",
    group: "modern",
    backgroundKind: "mesh",
    colors: ["#880e3e", "#b8144c", "#c43a0e", "#6e0832"],
    accentColor: "#fdba74",
    textColor: "#fffaf0",
    fontFamily: SANS,
    motion: MODERN_MOTION,
  },
  {
    presetId: "brutalist",
    name: "Industrial Yellow (Kinetic)",
    group: "modern",
    backgroundKind: "stripes",
    colors: ["#121214", "#1c1c22", "#0d0d0f", "#22222b"],
    accentColor: "#facc15",
    textColor: "#ffffff",
    fontFamily: SANS,
    motion: { ...MODERN_MOTION, hueShiftDegrees: 6, saturationBoost: 0.1 },
    pattern: "diagonal-stripes",
  },
  {
    presetId: "lime",
    name: "Neon Emerald (Kinetic)",
    group: "modern",
    backgroundKind: "mesh",
    colors: ["#011c14", "#043828", "#075c43", "#022b1e"],
    accentColor: "#2dd4bf",
    textColor: "#ccfbf1",
    fontFamily: SANS,
    motion: MODERN_MOTION,
  },
  // ---- Nature scene group (deterministic canvas particle systems) --------
  {
    presetId: "nature-foliage",
    name: "Whispering Foliage (Kinetic)",
    group: "nature",
    backgroundKind: "foliage",
    colors: ["#103118", "#0a2414", "#071a0f", "#030905"],
    accentColor: "#a3c76a",
    textColor: "#eafff1",
    fontFamily: CINZEL,
    motion: NATURE_MOTION,
  },
  {
    presetId: "nature-forest",
    name: "Forest Sanctuary (Kinetic)",
    group: "nature",
    backgroundKind: "forest",
    colors: ["#241d0a", "#18140a", "#0f0c05", "#0a0702"],
    accentColor: "#e0a856",
    textColor: "#fdf6e8",
    fontFamily: PLAYFAIR,
    motion: NATURE_MOTION,
  },
  {
    presetId: "nature-rain",
    name: "Gentle Rain (Kinetic)",
    group: "nature",
    backgroundKind: "rain",
    colors: ["#101c26", "#0c1620", "#070f16", "#04080c"],
    accentColor: "#94b6cc",
    textColor: "#eaf2f8",
    fontFamily: PLAYFAIR,
    motion: { ...NATURE_MOTION, driftAmount: 0.9 },
  },
  {
    presetId: "nature-autumn",
    name: "Autumn Fall (Kinetic)",
    group: "nature",
    backgroundKind: "autumn",
    colors: ["#241007", "#1c0e06", "#120803", "#0a0402"],
    accentColor: "#e4742c",
    textColor: "#fff1e6",
    fontFamily: BEBAS,
    motion: NATURE_MOTION,
  },
  {
    presetId: "nature-blossom",
    name: "Cherry Blossom (Kinetic)",
    group: "nature",
    backgroundKind: "blossom",
    colors: ["#251322", "#1e0f1b", "#140a12", "#09040b"],
    accentColor: "#f6a8c4",
    textColor: "#ffe9f1",
    fontFamily: PLAYFAIR,
    motion: NATURE_MOTION,
  },
  {
    presetId: "nature-snow",
    name: "Quiet Snowfall (Kinetic)",
    group: "nature",
    backgroundKind: "snow",
    colors: ["#2a3a4e", "#1c2838", "#121b26", "#0d1620"],
    accentColor: "#d8e8f8",
    textColor: "#f4f9ff",
    fontFamily: CINZEL,
    motion: { ...NATURE_MOTION, driftAmount: 0.35 },
  },
  {
    presetId: "nature-fireflies",
    name: "Fireflies & Mist (Kinetic)",
    group: "nature",
    backgroundKind: "fireflies",
    colors: ["#06120b", "#040d08", "#020805", "#010402"],
    accentColor: "#b8e86e",
    textColor: "#f0ffe0",
    fontFamily: CINZEL,
    motion: NATURE_MOTION,
  },
  {
    presetId: "nature-stars",
    name: "Starlit Night (Kinetic)",
    group: "nature",
    backgroundKind: "stars",
    colors: ["#070b1a", "#0a0f24", "#05081a", "#02030c"],
    accentColor: "#cbd5f5",
    textColor: "#eef2ff",
    fontFamily: PLAYFAIR,
    motion: { ...NATURE_MOTION, driftAmount: 0.3 },
  },
  {
    presetId: "nature-meadow",
    name: "Golden Meadow (Kinetic)",
    group: "nature",
    backgroundKind: "meadow",
    colors: ["#2a2410", "#332b12", "#1c1808", "#0f0d05"],
    accentColor: "#f5d67a",
    textColor: "#fff8e6",
    fontFamily: BEBAS,
    motion: NATURE_MOTION,
  },
  {
    presetId: "nature-aurora",
    name: "Northern Aurora (Kinetic)",
    group: "nature",
    backgroundKind: "aurora",
    colors: ["#04121a", "#06202a", "#031018", "#01080c"],
    accentColor: "#5ef0c0",
    textColor: "#e6fff6",
    fontFamily: CINZEL,
    motion: NATURE_MOTION,
  },
  // ---- Worship scene: Desert Cloth (canvas port of worship_background HTML)
  {
    presetId: "desert-cloth",
    name: "Desert Cloth (Kinetic)",
    group: "classical",
    backgroundKind: "cloth",
    colors: ["#cbab7f", "#b8956a", "#8a6a45"],
    accentColor: "#f3e8d2",
    textColor: "#fdf8ee",
    fontFamily: GEORGIA,
    // No hue/saturation breathing in this design; 6.5s matches the slowest
    // fold loop so kinetic hosts keep animating continuously.
    motion: { durationMs: 6500, driftAmount: 0.6, hueShiftDegrees: 0, saturationBoost: 0 },
  },
]

export function kineticThemeId(presetId: string): string {
  return `builtin-kinetic-${presetId}`
}

export const KINETIC_THEME_IDS: string[] = KINETIC_THEME_PRESETS.map((p) =>
  kineticThemeId(p.presetId),
)

function toKineticMetadata(preset: KineticThemePreset): BroadcastKineticTheme {
  return {
    source: "html-prototype-v2",
    presetId: preset.presetId,
    group: preset.group,
    backgroundKind: preset.backgroundKind,
    colors: preset.colors,
    accentColor: preset.accentColor,
    motion: preset.motion,
    pattern: preset.pattern,
  }
}

// A diagonal gradient mirroring the prototype's 135deg mesh. This is the static
// fallback background so the theme still renders if kinetic drawing is skipped
// or fails, and so non-kinetic-aware consumers see a representative frame.
function fallbackBackground(preset: KineticThemePreset): BroadcastTheme["background"] {
  const colors = preset.colors.length > 0 ? preset.colors : ["#000000", "#111111"]
  const stops = colors.map((color, index) => ({
    color,
    position: Math.round((index / Math.max(1, colors.length - 1)) * 100),
  }))
  return {
    type: "gradient",
    color: colors[0],
    gradient: { type: "linear", angle: 135, stops },
    image: null,
  }
}

export function buildKineticBroadcastTheme(
  preset: KineticThemePreset,
): BroadcastTheme {
  const isLight =
    preset.presetId === "editorial" || preset.presetId === "parchment"
  const theme: BroadcastTheme = {
    id: kineticThemeId(preset.presetId),
    name: preset.name,
    builtin: true,
    pinned: false,
    createdAt: 0,
    updatedAt: 0,
    resolution: { width: 1920, height: 1080 },
    background: fallbackBackground(preset),
    textBox: {
      enabled: false,
      color: "#000000",
      opacity: 0,
      borderRadius: 0,
      padding: 0,
    },
    verseText: {
      fontFamily: preset.fontFamily,
      fontSize: 76,
      fontWeight: 500,
      color: preset.textColor,
      horizontalAlign: "center",
      verticalAlign: "middle",
      textTransform: "none",
      textDecoration: "none",
      lineHeight: 1.4,
      letterSpacing: 0,
      shadow: isLight ? null : { color: "rgba(0,0,0,0.55)", blur: 16, x: 0, y: 4 },
      outline: null,
    },
    verseNumbers: {
      visible: true,
      fontSize: 18,
      color: preset.accentColor,
      superscript: true,
    },
    reference: {
      fontFamily: preset.fontFamily === DISPLAY_SERIF ? SANS : preset.fontFamily,
      fontSize: 36,
      fontWeight: 600,
      color: preset.accentColor,
      horizontalAlign: "center",
      verticalAlign: "middle",
      textTransform: "uppercase",
      textDecoration: "none",
      uppercase: true,
      letterSpacing: 3,
      position: "below",
    },
    layout: {
      anchor: "center",
      offsetX: 0,
      offsetY: 0,
      padding: { top: 78, right: 110, bottom: 78, left: 110 },
      textAlign: "center",
      backgroundWidth: 100,
      backgroundHeight: 100,
      textAreaWidth: 84,
      textAreaHeight: 76,
      referenceGap: 34,
    },
    transition: {
      type: "fade",
      duration: 500,
      easing: "ease-in-out",
      direction: "up",
    },
    kinetic: toKineticMetadata(preset),
  }

  // Desert Cloth carries the HTML design's own typography: Georgia italic
  // cream verse text with ink shadow, then quiet bottom metadata so the
  // app's reference/title does not compete with the portrait.
  if (preset.presetId === "desert-cloth") {
    theme.verseText = {
      ...theme.verseText,
      fontStyle: "italic",
      fontSize: 48,
      fontWeight: 400,
      lineHeight: 1.55,
      shadow: { color: "rgba(61,43,23,0.55)", blur: 6, x: 0, y: 2 },
    }
    theme.reference = {
      ...theme.reference,
      color: "#f3e8d2",
      fontSize: 26,
      fontWeight: 400,
      textTransform: "uppercase",
      uppercase: true,
      letterSpacing: 4,
      position: "below",
    }
    theme.layout = { ...theme.layout, textAreaWidth: 47, referenceGap: 40 }
    theme.transition = { ...theme.transition, duration: 1600 }
  }

  return theme
}

export function buildKineticBroadcastThemes(): BroadcastTheme[] {
  return KINETIC_THEME_PRESETS.map(buildKineticBroadcastTheme)
}
