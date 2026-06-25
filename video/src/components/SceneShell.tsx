import { AbsoluteFill } from "remotion";
import { COLORS, layout, type Orientation } from "../theme";

/** Shared bright scene backdrop + centered content column. */
export const SceneShell: React.FC<{
  orientation: Orientation;
  children: React.ReactNode;
  gap?: number;
}> = ({ orientation, children, gap = 52 }) => {
  const { pad } = layout(orientation);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(135% 100% at 50% 8%, ${COLORS.panel} 0%, ${COLORS.bg0} 38%, ${COLORS.bg1} 100%)`,
      }}
    >
      {/* soft warm glow accent */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(40% 30% at 50% 20%, ${COLORS.goldSoft} 0%, rgba(0,0,0,0) 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          padding: pad,
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
    </AbsoluteFill>
  );
};
