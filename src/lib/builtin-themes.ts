import type { BroadcastTheme } from "@/types/broadcast"

const baseTheme: Omit<
  BroadcastTheme,
  | "id"
  | "name"
  | "background"
  | "verseText"
  | "reference"
  | "layout"
  | "transition"
  | "textBox"
> = {
  builtin: true,
  pinned: false,
  createdAt: 0,
  updatedAt: 0,
  resolution: { width: 1920, height: 1080 },
  verseNumbers: {
    visible: true,
    fontSize: 14,
    color: "#ffffff",
    superscript: true,
  },
}

const CLASSIC_DARK: BroadcastTheme = {
  ...baseTheme,
  id: "builtin-classic-dark",
  name: "Classic Dark",
  background: {
    type: "gradient",
    color: "#1a1a3e",
    gradient: {
      type: "radial",
      angle: 0,
      stops: [
        { color: "#1a1a3e", position: 0 },
        { color: "#0a0a1a", position: 100 },
      ],
    },
    image: null,
  },
  textBox: {
    enabled: false,
    color: "#000000",
    opacity: 0,
    borderRadius: 0,
    padding: 0,
  },
  verseText: {
    fontFamily: "Source Serif 4 Variable",
    fontSize: 72,
    fontWeight: 400,
    color: "#ffffff",
    horizontalAlign: "center",
    verticalAlign: "top",
    textTransform: "none",
    textDecoration: "none",
    lineHeight: 1.5,
    letterSpacing: 0,
    shadow: null,
    outline: null,
  },
  verseNumbers: {
    visible: true,
    fontSize: 20,
    color: "#d4a574",
    superscript: true,
  },
  reference: {
    fontFamily: "Geist Variable",
    fontSize: 48,
    fontWeight: 500,
    color: "#d4a574",
    horizontalAlign: "center",
    verticalAlign: "top",
    textTransform: "none",
    textDecoration: "none",
    uppercase: true,
    letterSpacing: 2,
    position: "above",
  },
  layout: {
    anchor: "center",
    offsetX: 0,
    offsetY: 0,
    padding: { top: 60, right: 80, bottom: 60, left: 80 },
    textAlign: "center",
    backgroundWidth: 100,
    backgroundHeight: 100,
    textAreaWidth: 80,
    textAreaHeight: 80,
    referenceGap: 32,
  },
  transition: {
    type: "fade",
    duration: 500,
    easing: "ease-in-out",
    direction: "up",
  },
}

const MODERN_LIGHT: BroadcastTheme = {
  ...baseTheme,
  id: "builtin-modern-light",
  name: "Modern Light",
  background: {
    type: "solid",
    color: "#f5f5f0",
    gradient: null,
    image: null,
  },
  textBox: {
    enabled: false,
    color: "#000000",
    opacity: 0,
    borderRadius: 0,
    padding: 0,
  },
  verseText: {
    fontFamily: "Geist Variable",
    fontSize: 68,
    fontWeight: 400,
    color: "#1a1a1a",
    horizontalAlign: "left",
    verticalAlign: "top",
    textTransform: "none",
    textDecoration: "none",
    lineHeight: 1.6,
    letterSpacing: 0,
    shadow: null,
    outline: null,
  },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#666666",
    superscript: true,
  },
  reference: {
    fontFamily: "Geist Variable",
    fontSize: 45,
    fontWeight: 500,
    color: "#666666",
    horizontalAlign: "left",
    verticalAlign: "top",
    textTransform: "none",
    textDecoration: "none",
    uppercase: false,
    letterSpacing: 0,
    position: "above",
  },
  layout: {
    anchor: "center",
    offsetX: 0,
    offsetY: 0,
    padding: { top: 60, right: 80, bottom: 60, left: 80 },
    textAlign: "left",
    backgroundWidth: 100,
    backgroundHeight: 100,
    textAreaWidth: 80,
    textAreaHeight: 80,
    referenceGap: 30,
  },
  transition: {
    type: "slide",
    duration: 400,
    easing: "ease-out",
    direction: "up",
  },
}

const BROADCAST_OVERLAY: BroadcastTheme = {
  ...baseTheme,
  id: "builtin-broadcast-overlay",
  name: "Broadcast Overlay",
  background: {
    type: "transparent",
    color: "transparent",
    gradient: null,
    image: null,
  },
  textBox: {
    enabled: true,
    color: "#000000",
    opacity: 0.7,
    borderRadius: 12,
    padding: 24,
  },
  verseText: {
    fontFamily: "Geist Variable",
    fontSize: 64,
    fontWeight: 500,
    color: "#ffffff",
    horizontalAlign: "center",
    verticalAlign: "top",
    textTransform: "none",
    textDecoration: "none",
    lineHeight: 1.5,
    letterSpacing: 0,
    shadow: { color: "rgba(0,0,0,0.8)", blur: 8, x: 0, y: 2 },
    outline: null,
  },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#fbbf24",
    superscript: true,
  },
  reference: {
    fontFamily: "Geist Variable",
    fontSize: 43,
    fontWeight: 600,
    color: "#fbbf24",
    horizontalAlign: "center",
    verticalAlign: "top",
    textTransform: "none",
    textDecoration: "none",
    uppercase: false,
    letterSpacing: 1,
    position: "below",
  },
  layout: {
    anchor: "bottom-center",
    offsetX: 0,
    offsetY: 0,
    padding: { top: 40, right: 60, bottom: 40, left: 60 },
    textAlign: "center",
    backgroundWidth: 100,
    backgroundHeight: 100,
    textAreaWidth: 90,
    textAreaHeight: 40,
    referenceGap: 24,
  },
  transition: {
    type: "fade",
    duration: 300,
    easing: "ease-in-out",
    direction: "up",
  },
}

const FOREST_GLASS: BroadcastTheme = {
  ...MODERN_LIGHT,
  id: "builtin-forest-glass",
  name: "Forest Glass",
  background: {
    type: "gradient",
    color: "#13342f",
    gradient: {
      type: "linear",
      angle: 135,
      stops: [
        { color: "#13342f", position: 0 },
        { color: "#d7c27a", position: 100 },
      ],
    },
    image: null,
  },
  textBox: {
    enabled: true,
    color: "#071512",
    opacity: 0.55,
    borderRadius: 8,
    padding: 28,
  },
  verseText: {
    ...MODERN_LIGHT.verseText,
    fontSize: 66,
    color: "#f9faf7",
    lineHeight: 1.55,
  },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#f1d98a",
    superscript: true,
  },
  reference: {
    ...MODERN_LIGHT.reference,
    color: "#f1d98a",
    uppercase: true,
    letterSpacing: 1,
  },
}

const STAINED_WARMTH: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-stained-warmth",
  name: "Stained Warmth",
  background: {
    type: "gradient",
    color: "#35142a",
    gradient: {
      type: "radial",
      angle: 0,
      stops: [
        { color: "#7c2d12", position: 0 },
        { color: "#35142a", position: 58 },
        { color: "#111827", position: 100 },
      ],
    },
    image: null,
  },
  verseText: { ...CLASSIC_DARK.verseText, fontSize: 70, color: "#fff7ed" },
  verseNumbers: {
    visible: true,
    fontSize: 20,
    color: "#f59e0b",
    superscript: true,
  },
  reference: { ...CLASSIC_DARK.reference, color: "#fbbf24", letterSpacing: 1 },
}

const CLEAN_LOWER_THIRD: BroadcastTheme = {
  ...BROADCAST_OVERLAY,
  id: "builtin-clean-lower-third",
  name: "Clean Lower Third",
  textBox: {
    enabled: true,
    color: "#0f172a",
    opacity: 0.82,
    borderRadius: 6,
    padding: 22,
  },
  verseText: {
    ...BROADCAST_OVERLAY.verseText,
    fontSize: 54,
    fontWeight: 500,
    lineHeight: 1.38,
  },
  verseNumbers: {
    visible: false,
    fontSize: 16,
    color: "#38bdf8",
    superscript: true,
  },
  reference: {
    ...BROADCAST_OVERLAY.reference,
    fontSize: 30,
    color: "#38bdf8",
    horizontalAlign: "right",
    position: "below",
  },
  layout: {
    ...BROADCAST_OVERLAY.layout,
    anchor: "bottom-center",
    textAreaWidth: 88,
    textAreaHeight: 32,
    padding: { top: 40, right: 60, bottom: 56, left: 60 },
  },
}

const PAPER_READING: BroadcastTheme = {
  ...MODERN_LIGHT,
  id: "builtin-paper-reading",
  name: "Paper Reading",
  background: { type: "solid", color: "#fbfaf6", gradient: null, image: null },
  textBox: {
    enabled: false,
    color: "#000000",
    opacity: 0,
    borderRadius: 0,
    padding: 0,
  },
  verseText: {
    ...MODERN_LIGHT.verseText,
    fontFamily: "Source Serif 4 Variable",
    fontSize: 64,
    color: "#1f2933",
    lineHeight: 1.7,
  },
  verseNumbers: {
    visible: true,
    fontSize: 17,
    color: "#8a5a2b",
    superscript: true,
  },
  reference: {
    ...MODERN_LIGHT.reference,
    fontFamily: "Geist Variable",
    fontSize: 38,
    color: "#8a5a2b",
    uppercase: true,
    letterSpacing: 1,
  },
}

const MIDNIGHT_GOLD: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-midnight-gold",
  name: "Midnight Gold",
  background: {
    type: "gradient",
    color: "#050816",
    gradient: {
      type: "linear",
      angle: 120,
      stops: [
        { color: "#050816", position: 0 },
        { color: "#172554", position: 55 },
        { color: "#422006", position: 100 },
      ],
    },
    image: null,
  },
  verseText: {
    ...CLASSIC_DARK.verseText,
    fontSize: 74,
    fontWeight: 500,
    color: "#f8fafc",
  },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#facc15",
    superscript: true,
  },
  reference: { ...CLASSIC_DARK.reference, color: "#facc15", fontSize: 42 },
}

const HYMNS_BIG_LYRICS: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-hymns-big-lyrics",
  name: "Hymns Big Lyrics",
  background: { type: "solid", color: "#111111", gradient: null, image: null },
  textBox: {
    enabled: false,
    color: "#000000",
    opacity: 0,
    borderRadius: 0,
    padding: 0,
  },
  verseText: {
    ...CLASSIC_DARK.verseText,
    fontFamily: "Geist Variable",
    fontSize: 86,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  verseNumbers: {
    visible: false,
    fontSize: 16,
    color: "#ffffff",
    superscript: true,
  },
  reference: {
    ...CLASSIC_DARK.reference,
    fontSize: 34,
    color: "#22c55e",
    position: "below",
  },
  layout: {
    ...CLASSIC_DARK.layout,
    textAreaWidth: 88,
    textAreaHeight: 78,
    referenceGap: 24,
  },
}

const CALM_BLUE_WHITE: BroadcastTheme = {
  ...MODERN_LIGHT,
  id: "builtin-calm-blue-white",
  name: "Calm Blue White",
  background: {
    type: "gradient",
    color: "#eaf6ff",
    gradient: {
      type: "linear",
      angle: 180,
      stops: [
        { color: "#eaf6ff", position: 0 },
        { color: "#ffffff", position: 55 },
        { color: "#e8fff4", position: 100 },
      ],
    },
    image: null,
  },
  verseText: { ...MODERN_LIGHT.verseText, fontSize: 68, color: "#0f172a" },
  verseNumbers: {
    visible: true,
    fontSize: 17,
    color: "#0369a1",
    superscript: true,
  },
  reference: {
    ...MODERN_LIGHT.reference,
    color: "#047857",
    fontSize: 40,
    uppercase: true,
  },
}

const CINEMA_AMBER: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-cinema-amber",
  name: "Cinema Amber",
  background: {
    type: "gradient",
    color: "#120f0b",
    gradient: {
      type: "radial",
      angle: 0,
      stops: [
        { color: "#7c3f11", position: 0 },
        { color: "#1f1711", position: 56 },
        { color: "#050505", position: 100 },
      ],
    },
    image: null,
  },
  verseText: { ...CLASSIC_DARK.verseText, fontSize: 76, color: "#fff8eb" },
  verseNumbers: {
    visible: true,
    fontSize: 19,
    color: "#f59e0b",
    superscript: true,
  },
  reference: { ...CLASSIC_DARK.reference, color: "#fbbf24", fontSize: 40 },
}

const CINEMA_STEEL: BroadcastTheme = {
  ...MODERN_LIGHT,
  id: "builtin-cinema-steel",
  name: "Cinema Steel",
  background: {
    type: "gradient",
    color: "#0b1117",
    gradient: {
      type: "linear",
      angle: 145,
      stops: [
        { color: "#0b1117", position: 0 },
        { color: "#2f3a45", position: 55 },
        { color: "#d8dee6", position: 100 },
      ],
    },
    image: null,
  },
  textBox: {
    enabled: true,
    color: "#03070b",
    opacity: 0.52,
    borderRadius: 8,
    padding: 30,
  },
  verseText: { ...MODERN_LIGHT.verseText, fontSize: 68, color: "#f8fafc" },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#93c5fd",
    superscript: true,
  },
  reference: {
    ...MODERN_LIGHT.reference,
    color: "#bfdbfe",
    uppercase: true,
    letterSpacing: 1,
  },
}

const CINEMA_EMERALD: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-cinema-emerald",
  name: "Cinema Emerald",
  background: {
    type: "gradient",
    color: "#031511",
    gradient: {
      type: "radial",
      angle: 0,
      stops: [
        { color: "#0f766e", position: 0 },
        { color: "#064e3b", position: 45 },
        { color: "#020617", position: 100 },
      ],
    },
    image: null,
  },
  verseText: { ...CLASSIC_DARK.verseText, fontSize: 72, color: "#ecfdf5" },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#6ee7b7",
    superscript: true,
  },
  reference: { ...CLASSIC_DARK.reference, color: "#a7f3d0", fontSize: 40 },
}

const CINEMA_ROSE: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-cinema-rose",
  name: "Cinema Rose",
  background: {
    type: "gradient",
    color: "#210617",
    gradient: {
      type: "linear",
      angle: 115,
      stops: [
        { color: "#210617", position: 0 },
        { color: "#7f1d1d", position: 58 },
        { color: "#312e81", position: 100 },
      ],
    },
    image: null,
  },
  textBox: {
    enabled: true,
    color: "#0f0610",
    opacity: 0.42,
    borderRadius: 8,
    padding: 24,
  },
  verseText: { ...CLASSIC_DARK.verseText, fontSize: 70, color: "#fff1f2" },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#fda4af",
    superscript: true,
  },
  reference: { ...CLASSIC_DARK.reference, color: "#f9a8d4", fontSize: 40 },
}

const CINEMA_MONO: BroadcastTheme = {
  ...MODERN_LIGHT,
  id: "builtin-cinema-mono",
  name: "Cinema Mono",
  background: {
    type: "gradient",
    color: "#050505",
    gradient: {
      type: "linear",
      angle: 180,
      stops: [
        { color: "#050505", position: 0 },
        { color: "#262626", position: 70 },
        { color: "#f5f5f5", position: 100 },
      ],
    },
    image: null,
  },
  textBox: {
    enabled: true,
    color: "#000000",
    opacity: 0.58,
    borderRadius: 4,
    padding: 26,
  },
  verseText: {
    ...MODERN_LIGHT.verseText,
    fontSize: 66,
    color: "#ffffff",
    lineHeight: 1.55,
  },
  verseNumbers: {
    visible: false,
    fontSize: 16,
    color: "#ffffff",
    superscript: true,
  },
  reference: {
    ...MODERN_LIGHT.reference,
    color: "#d4d4d4",
    fontSize: 36,
    uppercase: true,
  },
}

const CINEMA_SUNRISE: BroadcastTheme = {
  ...MODERN_LIGHT,
  id: "builtin-cinema-sunrise",
  name: "Cinema Sunrise",
  background: {
    type: "gradient",
    color: "#fff7ed",
    gradient: {
      type: "linear",
      angle: 160,
      stops: [
        { color: "#fff7ed", position: 0 },
        { color: "#fed7aa", position: 42 },
        { color: "#7dd3fc", position: 100 },
      ],
    },
    image: null,
  },
  verseText: {
    ...MODERN_LIGHT.verseText,
    fontSize: 68,
    color: "#1c1917",
    lineHeight: 1.55,
  },
  verseNumbers: {
    visible: true,
    fontSize: 17,
    color: "#c2410c",
    superscript: true,
  },
  reference: {
    ...MODERN_LIGHT.reference,
    color: "#0369a1",
    fontSize: 38,
    uppercase: true,
  },
}

const CINEMA_NOIR_LOWER: BroadcastTheme = {
  ...BROADCAST_OVERLAY,
  id: "builtin-cinema-noir-lower",
  name: "Cinema Noir Lower",
  textBox: {
    enabled: true,
    color: "#020617",
    opacity: 0.86,
    borderRadius: 6,
    padding: 24,
  },
  verseText: {
    ...BROADCAST_OVERLAY.verseText,
    fontSize: 56,
    color: "#f8fafc",
    lineHeight: 1.35,
  },
  verseNumbers: {
    visible: false,
    fontSize: 16,
    color: "#ffffff",
    superscript: true,
  },
  reference: {
    ...BROADCAST_OVERLAY.reference,
    color: "#e5e7eb",
    fontSize: 30,
    position: "below",
  },
  layout: {
    ...BROADCAST_OVERLAY.layout,
    anchor: "bottom-center",
    textAreaWidth: 86,
    textAreaHeight: 34,
    padding: { top: 40, right: 70, bottom: 58, left: 70 },
  },
}

export const BUILTIN_THEMES: BroadcastTheme[] = [
  CLASSIC_DARK,
  MODERN_LIGHT,
  BROADCAST_OVERLAY,
  FOREST_GLASS,
  STAINED_WARMTH,
  CLEAN_LOWER_THIRD,
  PAPER_READING,
  MIDNIGHT_GOLD,
  HYMNS_BIG_LYRICS,
  CALM_BLUE_WHITE,
  CINEMA_AMBER,
  CINEMA_STEEL,
  CINEMA_EMERALD,
  CINEMA_ROSE,
  CINEMA_MONO,
  CINEMA_SUNRISE,
  CINEMA_NOIR_LOWER,
]
