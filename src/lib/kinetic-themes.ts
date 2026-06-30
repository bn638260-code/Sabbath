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
// These 14 presets mirror the moving "Kinetic Theme" selector from the
// SabbathCue HTML prototype v2. Each preset is the canvas-native description of
// a CSS theme: the four mesh-gradient colors, an accent, the motion envelope
// (liquidMesh duration + hue/saturation breathing + drift), and an optional
// overlay pattern (cyberpunk dot-grid, brutalist diagonal stripes).
//
// Fonts are mapped to fonts already bundled with the app (no network fonts) so
// the workflow stays fully offline. See the plan's APPROVED FONT APPROACH.
// ---------------------------------------------------------------------------

export interface KineticThemePreset {
  presetId: string
  /** Human label shown in the library (carries the original font intent). */
  name: string
  group: "classical" | "modern"
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
  const isLight = preset.presetId === "editorial" || preset.presetId === "parchment"
  return {
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
}

export function buildKineticBroadcastThemes(): BroadcastTheme[] {
  return KINETIC_THEME_PRESETS.map(buildKineticBroadcastTheme)
}
