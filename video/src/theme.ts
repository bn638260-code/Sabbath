import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";

const { fontFamily: fraunces } = loadFraunces("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});
const { fontFamily: spaceGrotesk } = loadSpaceGrotesk("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin"],
});

/** Bright, warm SabbathCue palette (light-mode, on-brand gold + ink). */
export const COLORS = {
  bg0: "#FCFBF8", // near-white warm
  bg1: "#EFE8DA", // cream
  panel: "#FFFFFF",
  ink: "#211C15", // primary text
  inkSoft: "#4F463A",
  slate: "#8A8170",
  gold: "#B07D24",
  goldDeep: "#8A5E18",
  goldSoft: "rgba(176,125,36,0.14)",
  green: "#1F9D5B",
  greenSoft: "rgba(31,157,91,0.13)",
  line: "rgba(33,28,21,0.08)",
  shadowSoft: "rgba(33,28,21,0.10)",
  shadowGold: "rgba(176,125,36,0.30)",
} as const;

export const FONTS = {
  display: fraunces,
  body: spaceGrotesk,
} as const;

export type Orientation = "landscape" | "portrait";

export const layout = (o: Orientation) => ({
  isPortrait: o === "portrait",
  pad: o === "portrait" ? 96 : 150,
});
