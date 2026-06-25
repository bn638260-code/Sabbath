import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneShell } from "../components/SceneShell";
import { Caption } from "../components/Caption";
import { Chip } from "../components/Chip";
import { COLORS, FONTS, type Orientation } from "../theme";

const Pins: React.FC<{ side: "top" | "bottom" }> = ({ side }) => (
  <div
    style={{
      position: "absolute",
      [side]: -10,
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      gap: 12,
    }}
  >
    {[0, 1, 2, 3, 4].map((i) => (
      <span key={i} style={{ width: 10, height: 18, borderRadius: 4, background: COLORS.gold, opacity: 0.7 }} />
    ))}
  </div>
);

/** Scene 5 — local-first, CPU-only, private (animated emblem, no screenshots). */
export const LocalFirst: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const portrait = orientation === "portrait";

  const enter = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const scale = interpolate(enter, [0, 1], [0.8, 1]);
  const glow = 0.4 + 0.25 * Math.sin(frame / 12); // gentle pulse
  const size = portrait ? 230 : 250;

  return (
    <SceneShell orientation={orientation} gap={46}>
      <Caption size={portrait ? 50 : 60} font="display">
        Runs on your booth PC.{" "}
        <span style={{ color: COLORS.gold }}>No GPU, no cloud.</span>
      </Caption>

      <div style={{ position: "relative", opacity: interpolate(enter, [0, 1], [0, 1]), transform: `scale(${scale})` }}>
        <div
          style={{
            position: "relative",
            width: size,
            height: size,
            borderRadius: 36,
            background: COLORS.panel,
            border: `3px solid ${COLORS.gold}`,
            boxShadow: `0 0 ${60 * glow}px ${COLORS.shadowGold}, 0 30px 70px ${COLORS.shadowSoft}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Pins side="top" />
          <Pins side="bottom" />
          <span style={{ fontFamily: FONTS.display, fontSize: 64, fontWeight: 600, color: COLORS.goldDeep }}>
            CPU
          </span>
          <span style={{ fontFamily: FONTS.body, fontSize: 22, fontWeight: 700, letterSpacing: 2, color: COLORS.slate }}>
            ON-DEVICE
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", maxWidth: 1000 }}>
        {["CPU-only", "No GPU", "Works offline", "Private"].map((t, i) => (
          <Chip key={t} variant="muted" delay={28 + i * 9} size={portrait ? 30 : 34}>
            {t}
          </Chip>
        ))}
      </div>
    </SceneShell>
  );
};
