import { interpolate, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "../theme";

/** Typewriter transcript line on a soft pill, with blinking caret. */
export const TranscriptType: React.FC<{
  text: string;
  start?: number;
  durationInFrames?: number;
  size?: number;
}> = ({ text, start = 0, durationInFrames = 60, size = 48 }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - start, [0, durationInFrames], [0, text.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shown = text.slice(0, Math.floor(progress));
  const done = progress >= text.length;
  const caretOn = Math.floor(frame / 15) % 2 === 0;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 16,
        padding: `${size * 0.34}px ${size * 0.6}px`,
        borderRadius: 999,
        background: COLORS.panel,
        border: `1px solid ${COLORS.line}`,
        boxShadow: `0 8px 24px ${COLORS.shadowSoft}`,
        fontFamily: FONTS.body,
        fontSize: size,
        fontWeight: 500,
        color: COLORS.ink,
        letterSpacing: 0.2,
      }}
    >
      <span
        style={{
          fontSize: size * 0.5,
          fontWeight: 700,
          letterSpacing: 1.5,
          color: COLORS.green,
          textTransform: "uppercase",
        }}
      >
        ● live
      </span>
      <span>
        {shown}
        <span style={{ opacity: !done && caretOn ? 1 : 0, color: COLORS.gold }}>|</span>
      </span>
    </div>
  );
};
