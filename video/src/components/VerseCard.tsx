import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../theme";

/** Bright lower-third scripture card: white panel, gold accent, ink text. */
export const VerseCard: React.FC<{
  reference: string;
  text: string;
  translation: string;
  delay?: number;
  width?: number;
}> = ({ reference, text, translation, delay = 0, width = 1180 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 200, mass: 0.8 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const y = interpolate(enter, [0, 1], [50, 0]);

  return (
    <div
      style={{
        width,
        opacity,
        transform: `translateY(${y}px)`,
        background: COLORS.panel,
        borderRadius: 26,
        border: `1px solid ${COLORS.line}`,
        boxShadow: `0 34px 90px ${COLORS.shadowSoft}, 0 4px 10px ${COLORS.shadowSoft}`,
        padding: "46px 54px 50px",
        display: "flex",
        gap: 36,
      }}
    >
      <div style={{ width: 8, borderRadius: 8, background: COLORS.gold, alignSelf: "stretch" }} />
      <div style={{ flex: 1, textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 20, marginBottom: 20 }}>
          <span
            style={{
              fontFamily: FONTS.display,
              fontSize: 54,
              fontWeight: 600,
              color: COLORS.goldDeep,
              letterSpacing: -0.5,
            }}
          >
            {reference}
          </span>
          <span
            style={{
              fontFamily: FONTS.body,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 1.5,
              color: COLORS.gold,
              background: COLORS.goldSoft,
              padding: "6px 16px",
              borderRadius: 999,
            }}
          >
            {translation}
          </span>
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: FONTS.display,
            fontSize: 44,
            lineHeight: 1.34,
            color: COLORS.ink,
            fontWeight: 400,
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
};
