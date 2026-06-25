import { AbsoluteFill, Img, staticFile } from "remotion";
import { COLORS, FONTS } from "../theme";

const PAD = 96;

/** Portrait slide backdrop with brand footer (wordmark + NN / total). */
export const SlideShell: React.FC<{
  index: number; // 1-based
  total: number;
  children: React.ReactNode;
  gap?: number;
}> = ({ index, total, children, gap = 40 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(130% 80% at 50% 6%, ${COLORS.panel} 0%, ${COLORS.bg0} 40%, ${COLORS.bg1} 100%)`,
    }}
  >
    <AbsoluteFill
      style={{
        background: `radial-gradient(45% 26% at 50% 16%, ${COLORS.goldSoft} 0%, rgba(0,0,0,0) 70%)`,
      }}
    />
    <AbsoluteFill
      style={{
        padding: PAD,
        paddingBottom: PAD + 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap,
        textAlign: "center",
      }}
    >
      {children}
    </AbsoluteFill>

    {/* footer */}
    <div
      style={{
        position: "absolute",
        left: PAD,
        right: PAD,
        bottom: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: FONTS.body,
        fontSize: 26,
        fontWeight: 600,
        color: COLORS.slate,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Img src={staticFile("logo.png")} style={{ width: 34, height: 34, objectFit: "contain" }} />
        Sabbath<span style={{ color: COLORS.gold }}>Cue</span>
      </span>
      <span style={{ letterSpacing: 1 }}>
        {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </span>
    </div>
  </AbsoluteFill>
);

/** Static (non-animated) headline. */
export const SHead: React.FC<{
  children: React.ReactNode;
  size?: number;
  font?: "display" | "body";
  color?: string;
  weight?: number;
  maxWidth?: number;
}> = ({ children, size = 84, font = "display", color = COLORS.ink, weight, maxWidth = 880 }) => (
  <div
    style={{
      fontFamily: FONTS[font],
      fontSize: size,
      fontWeight: weight ?? (font === "display" ? 500 : 600),
      color,
      lineHeight: 1.12,
      letterSpacing: font === "display" ? -1.2 : -0.4,
      maxWidth,
    }}
  >
    {children}
  </div>
);

/** Static body text. */
export const SBody: React.FC<{ children: React.ReactNode; size?: number; maxWidth?: number }> = ({
  children,
  size = 38,
  maxWidth = 820,
}) => (
  <div
    style={{
      fontFamily: FONTS.body,
      fontSize: size,
      fontWeight: 500,
      color: COLORS.inkSoft,
      lineHeight: 1.4,
      maxWidth,
    }}
  >
    {children}
  </div>
);

type ChipVariant = "detection" | "voice" | "lang" | "muted";
const CHIP: Record<ChipVariant, { bg: string; fg: string; border: string }> = {
  detection: { bg: COLORS.greenSoft, fg: COLORS.green, border: "rgba(31,157,91,0.30)" },
  voice: { bg: COLORS.goldSoft, fg: COLORS.goldDeep, border: "rgba(176,125,36,0.32)" },
  lang: { bg: COLORS.panel, fg: COLORS.ink, border: COLORS.line },
  muted: { bg: "rgba(33,28,21,0.04)", fg: COLORS.inkSoft, border: COLORS.line },
};

/** Static pill. */
export const SChip: React.FC<{ children: React.ReactNode; variant?: ChipVariant; size?: number }> = ({
  children,
  variant = "lang",
  size = 30,
}) => {
  const v = CHIP[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: `${size * 0.44}px ${size * 0.82}px`,
        borderRadius: 999,
        background: v.bg,
        color: v.fg,
        border: `1px solid ${v.border}`,
        boxShadow: `0 6px 18px ${COLORS.shadowSoft}`,
        fontFamily: FONTS.body,
        fontSize: size,
        fontWeight: 600,
        letterSpacing: 0.3,
      }}
    >
      {children}
    </span>
  );
};

/** Static scripture card. */
export const SVerseCard: React.FC<{
  reference: string;
  text: string;
  translation: string;
  width?: number;
}> = ({ reference, text, translation, width = 880 }) => (
  <div
    style={{
      width,
      background: COLORS.panel,
      borderRadius: 26,
      border: `1px solid ${COLORS.line}`,
      boxShadow: `0 30px 80px ${COLORS.shadowSoft}`,
      padding: "40px 46px 44px",
      display: "flex",
      gap: 30,
      textAlign: "left",
    }}
  >
    <div style={{ width: 8, borderRadius: 8, background: COLORS.gold, alignSelf: "stretch" }} />
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 16 }}>
        <span style={{ fontFamily: FONTS.display, fontSize: 48, fontWeight: 600, color: COLORS.goldDeep }}>
          {reference}
        </span>
        <span
          style={{
            fontFamily: FONTS.body,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 1.5,
            color: COLORS.gold,
            background: COLORS.goldSoft,
            padding: "5px 14px",
            borderRadius: 999,
          }}
        >
          {translation}
        </span>
      </div>
      <p style={{ margin: 0, fontFamily: FONTS.display, fontSize: 40, lineHeight: 1.34, color: COLORS.ink }}>
        {text}
      </p>
    </div>
  </div>
);
