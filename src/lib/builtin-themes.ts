import type { BroadcastTheme } from "@/types/broadcast"
import { buildKineticBroadcastThemes } from "@/lib/kinetic-themes"

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

const CINEMA_SAPPHIRE_HAZE: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-cinema-sapphire-haze",
  name: "Cinema Sapphire Haze",
  background: {
    type: "gradient",
    color: "#06111f",
    gradient: {
      type: "radial",
      angle: 0,
      stops: [
        { color: "#2563eb", position: 0 },
        { color: "#0f274a", position: 48 },
        { color: "#04070d", position: 100 },
      ],
    },
    image: null,
  },
  textBox: {
    enabled: true,
    color: "#020617",
    opacity: 0.46,
    borderRadius: 8,
    padding: 30,
  },
  verseText: {
    ...CLASSIC_DARK.verseText,
    fontSize: 72,
    color: "#eff6ff",
    shadow: { color: "rgba(0,0,0,0.7)", blur: 14, x: 0, y: 4 },
  },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#93c5fd",
    superscript: true,
  },
  reference: { ...CLASSIC_DARK.reference, color: "#bfdbfe", fontSize: 40 },
}

const CINEMA_COPPER_DAWN: BroadcastTheme = {
  ...MODERN_LIGHT,
  id: "builtin-cinema-copper-dawn",
  name: "Cinema Copper Dawn",
  background: {
    type: "gradient",
    color: "#fff7ed",
    gradient: {
      type: "linear",
      angle: 150,
      stops: [
        { color: "#fff7ed", position: 0 },
        { color: "#fdba74", position: 44 },
        { color: "#14532d", position: 100 },
      ],
    },
    image: null,
  },
  textBox: {
    enabled: true,
    color: "#1c1917",
    opacity: 0.24,
    borderRadius: 8,
    padding: 28,
  },
  verseText: {
    ...MODERN_LIGHT.verseText,
    fontFamily: "Source Serif 4 Variable",
    fontSize: 68,
    color: "#1c1917",
    lineHeight: 1.55,
  },
  verseNumbers: {
    visible: true,
    fontSize: 17,
    color: "#9a3412",
    superscript: true,
  },
  reference: {
    ...MODERN_LIGHT.reference,
    color: "#166534",
    fontSize: 38,
    uppercase: true,
    letterSpacing: 1,
  },
}

const CINEMA_CRIMSON_VEIL: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-cinema-crimson-veil",
  name: "Cinema Crimson Veil",
  background: {
    type: "gradient",
    color: "#13040b",
    gradient: {
      type: "radial",
      angle: 0,
      stops: [
        { color: "#be123c", position: 0 },
        { color: "#4c0519", position: 54 },
        { color: "#050505", position: 100 },
      ],
    },
    image: null,
  },
  textBox: {
    enabled: true,
    color: "#09090b",
    opacity: 0.5,
    borderRadius: 8,
    padding: 26,
  },
  verseText: {
    ...CLASSIC_DARK.verseText,
    fontSize: 70,
    color: "#fff1f2",
    shadow: { color: "rgba(0,0,0,0.82)", blur: 12, x: 0, y: 3 },
  },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#fda4af",
    superscript: true,
  },
  reference: { ...CLASSIC_DARK.reference, color: "#fecdd3", fontSize: 39 },
}

const CINEMA_ALPINE_MIST: BroadcastTheme = {
  ...MODERN_LIGHT,
  id: "builtin-cinema-alpine-mist",
  name: "Cinema Alpine Mist",
  background: {
    type: "gradient",
    color: "#f8fafc",
    gradient: {
      type: "linear",
      angle: 165,
      stops: [
        { color: "#f8fafc", position: 0 },
        { color: "#bae6fd", position: 48 },
        { color: "#334155", position: 100 },
      ],
    },
    image: null,
  },
  textBox: {
    enabled: true,
    color: "#ffffff",
    opacity: 0.5,
    borderRadius: 8,
    padding: 28,
  },
  verseText: {
    ...MODERN_LIGHT.verseText,
    fontSize: 66,
    color: "#0f172a",
    lineHeight: 1.58,
  },
  verseNumbers: {
    visible: false,
    fontSize: 16,
    color: "#0f172a",
    superscript: true,
  },
  reference: {
    ...MODERN_LIGHT.reference,
    color: "#075985",
    fontSize: 36,
    uppercase: true,
  },
}

const CINEMA_LANTERN_LOWER: BroadcastTheme = {
  ...BROADCAST_OVERLAY,
  id: "builtin-cinema-lantern-lower",
  name: "Cinema Lantern Lower",
  textBox: {
    enabled: true,
    color: "#1a1208",
    opacity: 0.84,
    borderRadius: 6,
    padding: 26,
  },
  verseText: {
    ...BROADCAST_OVERLAY.verseText,
    fontFamily: "Source Serif 4 Variable",
    fontSize: 58,
    color: "#fff7ed",
    lineHeight: 1.36,
  },
  verseNumbers: {
    visible: true,
    fontSize: 16,
    color: "#fbbf24",
    superscript: true,
  },
  reference: {
    ...BROADCAST_OVERLAY.reference,
    color: "#fde68a",
    fontSize: 31,
    position: "below",
  },
  layout: {
    ...BROADCAST_OVERLAY.layout,
    anchor: "bottom-center",
    textAreaWidth: 88,
    textAreaHeight: 36,
    padding: { top: 40, right: 68, bottom: 56, left: 68 },
  },
}

const PREMIUM_SERIF: BroadcastTheme["verseText"] = {
  ...CLASSIC_DARK.verseText,
  fontFamily: "DM Serif Display",
  fontSize: 78,
  fontWeight: 400,
  horizontalAlign: "center",
  verticalAlign: "middle",
  lineHeight: 1.38,
  letterSpacing: 0,
  shadow: { color: "rgba(0,0,0,0.72)", blur: 20, x: 0, y: 5 },
}

const PREMIUM_REFERENCE: BroadcastTheme["reference"] = {
  ...CLASSIC_DARK.reference,
  fontFamily: "Source Sans 3 Variable",
  fontSize: 34,
  fontWeight: 700,
  horizontalAlign: "center",
  verticalAlign: "middle",
  uppercase: true,
  letterSpacing: 3,
  position: "below",
}

const PREMIUM_LAYOUT: BroadcastTheme["layout"] = {
  ...CLASSIC_DARK.layout,
  anchor: "center",
  padding: { top: 78, right: 110, bottom: 78, left: 110 },
  textAlign: "center",
  textAreaWidth: 84,
  textAreaHeight: 76,
  referenceGap: 34,
}

const PREMIUM_SUNRISE_GLORY: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-premium-sunrise-glory",
  name: "Premium Sunrise Glory",
  background: {
    type: "gradient",
    color: "#1c0e0b",
    gradient: {
      type: "linear",
      angle: 135,
      stops: [
        { color: "#1c0e0b", position: 0 },
        { color: "#3a1c15", position: 50 },
        { color: "#150907", position: 100 },
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
  verseText: { ...PREMIUM_SERIF, color: "#fff7ed" },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#fb923c",
    superscript: true,
  },
  reference: { ...PREMIUM_REFERENCE, color: "#fed7aa" },
  layout: PREMIUM_LAYOUT,
  transition: { ...CLASSIC_DARK.transition, duration: 520 },
}

const PREMIUM_MIDNIGHT_OCEAN: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-premium-midnight-ocean",
  name: "Premium Midnight Ocean",
  background: {
    type: "gradient",
    color: "#06152d",
    gradient: {
      type: "linear",
      angle: 135,
      stops: [
        { color: "#06152d", position: 0 },
        { color: "#0a2540", position: 50 },
        { color: "#020b18", position: 100 },
      ],
    },
    image: null,
  },
  textBox: PREMIUM_SUNRISE_GLORY.textBox,
  verseText: { ...PREMIUM_SERIF, color: "#eff6ff" },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#38bdf8",
    superscript: true,
  },
  reference: { ...PREMIUM_REFERENCE, color: "#bae6fd" },
  layout: PREMIUM_LAYOUT,
  transition: { ...CLASSIC_DARK.transition, duration: 520 },
}

const PREMIUM_CELESTIAL_VELVET: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-premium-celestial-velvet",
  name: "Premium Celestial Velvet",
  background: {
    type: "gradient",
    color: "#120b29",
    gradient: {
      type: "linear",
      angle: 135,
      stops: [
        { color: "#120b29", position: 0 },
        { color: "#25133e", position: 50 },
        { color: "#070313", position: 100 },
      ],
    },
    image: null,
  },
  textBox: PREMIUM_SUNRISE_GLORY.textBox,
  verseText: { ...PREMIUM_SERIF, color: "#faf5ff" },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#c084fc",
    superscript: true,
  },
  reference: { ...PREMIUM_REFERENCE, color: "#ddd6fe" },
  layout: PREMIUM_LAYOUT,
  transition: { ...CLASSIC_DARK.transition, duration: 520 },
}

const PREMIUM_EMERALD_SAGE: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-premium-emerald-sage",
  name: "Premium Emerald Sage",
  background: {
    type: "gradient",
    color: "#091712",
    gradient: {
      type: "linear",
      angle: 135,
      stops: [
        { color: "#091712", position: 0 },
        { color: "#122c22", position: 50 },
        { color: "#040a08", position: 100 },
      ],
    },
    image: null,
  },
  textBox: PREMIUM_SUNRISE_GLORY.textBox,
  verseText: { ...PREMIUM_SERIF, color: "#ecfdf5" },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#4ade80",
    superscript: true,
  },
  reference: { ...PREMIUM_REFERENCE, color: "#bbf7d0" },
  layout: PREMIUM_LAYOUT,
  transition: { ...CLASSIC_DARK.transition, duration: 520 },
}

const PREMIUM_CRIMSON_CHAPEL: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-premium-crimson-chapel",
  name: "Premium Crimson Chapel",
  background: {
    type: "gradient",
    color: "#190711",
    gradient: {
      type: "linear",
      angle: 135,
      stops: [
        { color: "#190711", position: 0 },
        { color: "#4a0f1f", position: 52 },
        { color: "#09030a", position: 100 },
      ],
    },
    image: null,
  },
  textBox: PREMIUM_SUNRISE_GLORY.textBox,
  verseText: { ...PREMIUM_SERIF, color: "#fff1f2" },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#fb7185",
    superscript: true,
  },
  reference: { ...PREMIUM_REFERENCE, color: "#fecdd3" },
  layout: PREMIUM_LAYOUT,
  transition: { ...CLASSIC_DARK.transition, duration: 520 },
}

const PREMIUM_GILDED_INDIGO: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-premium-gilded-indigo",
  name: "Premium Gilded Indigo",
  background: {
    type: "gradient",
    color: "#0a1026",
    gradient: {
      type: "linear",
      angle: 135,
      stops: [
        { color: "#0a1026", position: 0 },
        { color: "#1e1b4b", position: 48 },
        { color: "#2b1607", position: 100 },
      ],
    },
    image: null,
  },
  textBox: PREMIUM_SUNRISE_GLORY.textBox,
  verseText: { ...PREMIUM_SERIF, color: "#fffaf0" },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#facc15",
    superscript: true,
  },
  reference: { ...PREMIUM_REFERENCE, color: "#fde68a" },
  layout: PREMIUM_LAYOUT,
  transition: { ...CLASSIC_DARK.transition, duration: 520 },
}

const PREMIUM_RIVER_STONE: BroadcastTheme = {
  ...CLASSIC_DARK,
  id: "builtin-premium-river-stone",
  name: "Premium River Stone",
  background: {
    type: "gradient",
    color: "#071412",
    gradient: {
      type: "linear",
      angle: 135,
      stops: [
        { color: "#071412", position: 0 },
        { color: "#164e63", position: 54 },
        { color: "#111827", position: 100 },
      ],
    },
    image: null,
  },
  textBox: PREMIUM_SUNRISE_GLORY.textBox,
  verseText: { ...PREMIUM_SERIF, color: "#f0fdfa" },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#5eead4",
    superscript: true,
  },
  reference: { ...PREMIUM_REFERENCE, color: "#ccfbf1" },
  layout: PREMIUM_LAYOUT,
  transition: { ...CLASSIC_DARK.transition, duration: 520 },
}

const PREMIUM_PEARL_DAWN: BroadcastTheme = {
  ...MODERN_LIGHT,
  id: "builtin-premium-pearl-dawn",
  name: "Premium Pearl Dawn",
  background: {
    type: "gradient",
    color: "#fff8f1",
    gradient: {
      type: "linear",
      angle: 135,
      stops: [
        { color: "#fff8f1", position: 0 },
        { color: "#fde2d2", position: 50 },
        { color: "#dbeafe", position: 100 },
      ],
    },
    image: null,
  },
  textBox: {
    enabled: true,
    color: "#ffffff",
    opacity: 0.34,
    borderRadius: 8,
    padding: 24,
  },
  verseText: {
    ...PREMIUM_SERIF,
    color: "#1f2937",
    shadow: { color: "rgba(255,255,255,0.55)", blur: 10, x: 0, y: 2 },
  },
  verseNumbers: {
    visible: true,
    fontSize: 18,
    color: "#c2410c",
    superscript: true,
  },
  reference: { ...PREMIUM_REFERENCE, color: "#075985" },
  layout: PREMIUM_LAYOUT,
  transition: { ...MODERN_LIGHT.transition, type: "fade", duration: 520 },
}

// "Veil" family: a near-full-frame translucent scrim over live video
// (transparent background + large text box), title-style reference above a
// centered body with tall line spacing — sized to hold hymn stanzas, single
// verses, or full paragraphs without reflowing the design.
const VEIL_LAYOUT: BroadcastTheme["layout"] = {
  anchor: "center",
  offsetX: 0,
  offsetY: 0,
  padding: { top: 72, right: 110, bottom: 72, left: 110 },
  textAlign: "center",
  backgroundWidth: 100,
  backgroundHeight: 100,
  textAreaWidth: 92,
  textAreaHeight: 88,
  referenceGap: 40,
}

const VEIL_BODY: BroadcastTheme["verseText"] = {
  fontFamily: "Geist Variable",
  fontSize: 64,
  fontWeight: 500,
  color: "#1f2937",
  horizontalAlign: "center",
  verticalAlign: "middle",
  textTransform: "none",
  textDecoration: "none",
  lineHeight: 1.6,
  letterSpacing: 0,
  shadow: null,
  outline: null,
}

const VEIL_TITLE: BroadcastTheme["reference"] = {
  fontFamily: "Geist Variable",
  fontSize: 54,
  fontWeight: 700,
  color: "#111827",
  horizontalAlign: "center",
  verticalAlign: "top",
  textTransform: "none",
  textDecoration: "none",
  uppercase: false,
  letterSpacing: 0,
  position: "above",
}

const VEIL_TRANSPARENT_BACKGROUND: BroadcastTheme["background"] = {
  type: "transparent",
  color: "transparent",
  gradient: null,
  image: null,
}

const CINEMA_VEIL_MIST: BroadcastTheme = {
  ...baseTheme,
  id: "builtin-cinema-veil-mist",
  name: "Cinema Veil Mist",
  background: VEIL_TRANSPARENT_BACKGROUND,
  textBox: {
    enabled: true,
    color: "#e3f1ef",
    opacity: 0.72,
    borderRadius: 10,
    padding: 48,
  },
  verseText: { ...VEIL_BODY, color: "#1c2b2a" },
  verseNumbers: {
    visible: false,
    fontSize: 16,
    color: "#1c2b2a",
    superscript: true,
  },
  reference: { ...VEIL_TITLE, color: "#122220" },
  layout: VEIL_LAYOUT,
  transition: {
    type: "fade",
    duration: 500,
    easing: "ease-in-out",
    direction: "up",
  },
}

const CINEMA_VEIL_IVORY: BroadcastTheme = {
  ...CINEMA_VEIL_MIST,
  id: "builtin-cinema-veil-ivory",
  name: "Cinema Veil Ivory",
  textBox: { ...CINEMA_VEIL_MIST.textBox, color: "#f6efe2", opacity: 0.74 },
  verseText: {
    ...VEIL_BODY,
    fontFamily: "Source Serif 4 Variable",
    color: "#2b1d12",
  },
  verseNumbers: {
    visible: false,
    fontSize: 16,
    color: "#2b1d12",
    superscript: true,
  },
  reference: {
    ...VEIL_TITLE,
    fontFamily: "Source Serif 4 Variable",
    color: "#7c4a12",
  },
}

const CINEMA_VEIL_DAWN: BroadcastTheme = {
  ...CINEMA_VEIL_MIST,
  id: "builtin-cinema-veil-dawn",
  name: "Cinema Veil Dawn",
  textBox: { ...CINEMA_VEIL_MIST.textBox, color: "#f5e4e8", opacity: 0.72 },
  verseText: { ...VEIL_BODY, color: "#3b1026" },
  verseNumbers: {
    visible: false,
    fontSize: 16,
    color: "#3b1026",
    superscript: true,
  },
  reference: { ...VEIL_TITLE, color: "#6d1338" },
}

const CINEMA_VEIL_OLIVE: BroadcastTheme = {
  ...CINEMA_VEIL_MIST,
  id: "builtin-cinema-veil-olive",
  name: "Cinema Veil Olive",
  textBox: { ...CINEMA_VEIL_MIST.textBox, color: "#e9eedd", opacity: 0.74 },
  verseText: { ...VEIL_BODY, color: "#1f2b16" },
  verseNumbers: {
    visible: false,
    fontSize: 16,
    color: "#1f2b16",
    superscript: true,
  },
  reference: { ...VEIL_TITLE, color: "#3f5220" },
}

const CINEMA_VEIL_SMOKE: BroadcastTheme = {
  ...CINEMA_VEIL_MIST,
  id: "builtin-cinema-veil-smoke",
  name: "Cinema Veil Smoke",
  textBox: { ...CINEMA_VEIL_MIST.textBox, color: "#0b1014", opacity: 0.62 },
  verseText: {
    ...VEIL_BODY,
    fontFamily: "Source Serif 4 Variable",
    color: "#f8f5ee",
    shadow: { color: "rgba(0,0,0,0.6)", blur: 10, x: 0, y: 2 },
  },
  verseNumbers: {
    visible: false,
    fontSize: 16,
    color: "#f8f5ee",
    superscript: true,
  },
  reference: { ...VEIL_TITLE, color: "#f0c75e" },
}

const CINEMA_VEIL_DUSK: BroadcastTheme = {
  ...CINEMA_VEIL_MIST,
  id: "builtin-cinema-veil-dusk",
  name: "Cinema Veil Dusk",
  textBox: { ...CINEMA_VEIL_MIST.textBox, color: "#10142b", opacity: 0.6 },
  verseText: {
    ...VEIL_BODY,
    color: "#eef2ff",
    shadow: { color: "rgba(0,0,0,0.55)", blur: 10, x: 0, y: 2 },
  },
  verseNumbers: {
    visible: false,
    fontSize: 16,
    color: "#eef2ff",
    superscript: true,
  },
  reference: { ...VEIL_TITLE, color: "#a5b4fc" },
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
  CINEMA_SAPPHIRE_HAZE,
  CINEMA_COPPER_DAWN,
  CINEMA_CRIMSON_VEIL,
  CINEMA_ALPINE_MIST,
  CINEMA_LANTERN_LOWER,
  CINEMA_VEIL_MIST,
  CINEMA_VEIL_IVORY,
  CINEMA_VEIL_DAWN,
  CINEMA_VEIL_OLIVE,
  CINEMA_VEIL_SMOKE,
  CINEMA_VEIL_DUSK,
  PREMIUM_SUNRISE_GLORY,
  PREMIUM_MIDNIGHT_OCEAN,
  PREMIUM_CELESTIAL_VELVET,
  PREMIUM_EMERALD_SAGE,
  PREMIUM_CRIMSON_CHAPEL,
  PREMIUM_GILDED_INDIGO,
  PREMIUM_RIVER_STONE,
  PREMIUM_PEARL_DAWN,
  // Kinetic (moving-background) presets are appended last so existing built-in
  // theme IDs and ordering are unchanged. Each carries optional `kinetic`
  // metadata; static themes are untouched.
  ...buildKineticBroadcastThemes(),
]
