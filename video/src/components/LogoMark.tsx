import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../theme";

/** Logo image + "SabbathCue" wordmark, revealed together (light theme). */
export const LogoMark: React.FC<{
  delay?: number;
  size?: number;
  showWordmark?: boolean;
}> = ({ delay = 0, size = 120, showWordmark = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const scale = interpolate(enter, [0, 1], [0.82, 1]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 26, opacity, transform: `scale(${scale})` }}>
      <Img src={staticFile("logo.png")} style={{ width: size, height: size, objectFit: "contain" }} />
      {showWordmark ? (
        <span
          style={{
            fontFamily: FONTS.display,
            fontSize: size * 0.8,
            fontWeight: 600,
            color: COLORS.ink,
            letterSpacing: -1,
          }}
        >
          Sabbath<span style={{ color: COLORS.gold }}>Cue</span>
        </span>
      ) : null}
    </div>
  );
};
