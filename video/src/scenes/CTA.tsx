import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneShell } from "../components/SceneShell";
import { LogoMark } from "../components/LogoMark";
import { Caption } from "../components/Caption";
import { COLORS, FONTS, type Orientation } from "../theme";

// EDIT ME: the call-to-action URL shown on the end card.
const SITE_URL = "sabbathcue.app";

/** Scene 6 — call to action / end card. */
export const CTA: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = orientation === "portrait";

  const btn = spring({ frame: frame - 38, fps, config: { damping: 200 } });

  return (
    <SceneShell orientation={orientation} gap={portrait ? 38 : 44}>
      <LogoMark delay={2} size={portrait ? 122 : 134} />

      <Caption delay={16} font="display" size={portrait ? 56 : 70}>
        Start your <span style={{ color: COLORS.gold }}>14-day free trial</span>
      </Caption>
      <Caption delay={26} size={portrait ? 30 : 36} color={COLORS.slate} weight={500}>
        Free · no card · Windows
      </Caption>

      <div
        style={{
          opacity: interpolate(btn, [0, 1], [0, 1]),
          transform: `scale(${interpolate(btn, [0, 1], [0.86, 1])})`,
          fontFamily: FONTS.body,
          fontSize: portrait ? 36 : 40,
          fontWeight: 700,
          color: "#FFFFFF",
          background: `linear-gradient(180deg, ${COLORS.gold}, ${COLORS.goldDeep})`,
          padding: "22px 50px",
          borderRadius: 16,
          boxShadow: `0 20px 50px ${COLORS.shadowGold}`,
          letterSpacing: 0.4,
        }}
      >
        Download for Windows ↓
      </div>

      <Caption delay={50} size={portrait ? 30 : 34} color={COLORS.goldDeep} weight={600}>
        {SITE_URL}
      </Caption>
    </SceneShell>
  );
};
