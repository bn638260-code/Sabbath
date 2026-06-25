import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../theme";

export const Caption: React.FC<{
  children: React.ReactNode;
  delay?: number;
  size?: number;
  color?: string;
  weight?: number;
  font?: "display" | "body";
  maxWidth?: number;
}> = ({
  children,
  delay = 0,
  size = 64,
  color = COLORS.ink,
  weight = 600,
  font = "body",
  maxWidth = 1500,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const y = interpolate(enter, [0, 1], [26, 0]);

  return (
    <div
      style={{
        fontFamily: FONTS[font],
        fontSize: size,
        fontWeight: font === "display" ? 500 : weight,
        color,
        lineHeight: 1.15,
        letterSpacing: font === "display" ? -1 : -0.4,
        maxWidth,
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      {children}
    </div>
  );
};
