import { interpolate, useCurrentFrame } from "remotion";
import { SceneShell } from "../components/SceneShell";
import { Caption } from "../components/Caption";
import { Chip } from "../components/Chip";
import { COLORS, FONTS, type Orientation } from "../theme";

const VERSES = [
  { ref: "8:1", text: "There is therefore now no condemnation to them which are in Christ Jesus" },
  { ref: "8:2", text: "For the law of the Spirit of life in Christ Jesus hath made me free" },
  { ref: "8:3", text: "For what the law could not do, in that it was weak through the flesh" },
  { ref: "8:4", text: "That the righteousness of the law might be fulfilled in us" },
  { ref: "8:5", text: "For they that are after the flesh do mind the things of the flesh" },
];

/** Scene 4 — reading mode: a live chapter with the highlight advancing by voice. */
export const ReadingMode: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const portrait = orientation === "portrait";
  const panelW = portrait ? 900 : 1180;
  const rowH = portrait ? 96 : 84;
  const headerH = 78;

  // Smooth highlight slide across verses.
  const active = interpolate(frame, [22, 50, 78, 106, 134], [0, 1, 2, 3, 4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneShell orientation={orientation} gap={40}>
      <Caption size={portrait ? 52 : 62} font="display">
        Reading a chapter? <span style={{ color: COLORS.gold }}>It follows along.</span>
      </Caption>

      <div
        style={{
          width: panelW,
          background: COLORS.panel,
          borderRadius: 26,
          border: `1px solid ${COLORS.line}`,
          boxShadow: `0 34px 90px ${COLORS.shadowSoft}`,
          padding: 30,
          textAlign: "left",
        }}
      >
        <div
          style={{
            height: headerH - 30,
            display: "flex",
            alignItems: "center",
            gap: 14,
            paddingLeft: 8,
            marginBottom: 14,
          }}
        >
          <span style={{ fontFamily: FONTS.display, fontSize: 36, fontWeight: 600, color: COLORS.goldDeep }}>
            Romans 8
          </span>
          <span style={{ fontFamily: FONTS.body, fontSize: 22, fontWeight: 700, letterSpacing: 1.5, color: COLORS.slate }}>
            READING MODE
          </span>
        </div>

        <div style={{ position: "relative" }}>
          {/* moving highlight */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: active * rowH,
              height: rowH,
              background: COLORS.goldSoft,
              border: `1px solid rgba(176,125,36,0.30)`,
              borderRadius: 16,
            }}
          />
          {VERSES.map((v, i) => {
            const isActive = Math.round(active) === i;
            return (
              <div
                key={v.ref}
                style={{
                  position: "relative",
                  height: rowH,
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "0 18px",
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 30,
                    fontWeight: 600,
                    color: isActive ? COLORS.goldDeep : COLORS.slate,
                    width: 70,
                  }}
                >
                  {v.ref}
                </span>
                <span
                  style={{
                    fontFamily: FONTS.body,
                    fontSize: portrait ? 26 : 28,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? COLORS.ink : COLORS.inkSoft,
                    opacity: isActive ? 1 : 0.7,
                  }}
                >
                  {v.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
        <Chip variant="voice" delay={40} size={portrait ? 30 : 34}>
          🎙 “next”
        </Chip>
        <Chip variant="voice" delay={96} size={portrait ? 30 : 34}>
          🎙 “next verse”
        </Chip>
      </div>
    </SceneShell>
  );
};
