import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../theme";

type Variant = "detection" | "voice" | "lang" | "muted";

const VARIANTS: Record<Variant, { bg: string; fg: string; border: string; dot?: string }> = {
  detection: { bg: COLORS.greenSoft, fg: COLORS.green, border: "rgba(31,157,91,0.30)", dot: COLORS.green },
  voice: { bg: COLORS.goldSoft, fg: COLORS.goldDeep, border: "rgba(176,125,36,0.32)" },
  lang: { bg: COLORS.panel, fg: COLORS.ink, border: COLORS.line },
  muted: { bg: "rgba(33,28,21,0.04)", fg: COLORS.inkSoft, border: COLORS.line },
};

export const Chip: React.FC<{
  children: React.ReactNode;
  variant?: Variant;
  delay?: number;
  size?: number;
}> = ({ children, variant = "lang", delay = 0, size = 30 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const v = VARIANTS[variant];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
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
        opacity: interpolate(enter, [0, 1], [0, 1]),
        transform: `scale(${interpolate(enter, [0, 1], [0.86, 1])})`,
      }}
    >
      {v.dot ? (
        <span
          style={{
            width: size * 0.36,
            height: size * 0.36,
            borderRadius: 999,
            background: v.dot,
            boxShadow: `0 0 ${size * 0.5}px ${v.dot}`,
          }}
        />
      ) : null}
      {children}
    </div>
  );
};
