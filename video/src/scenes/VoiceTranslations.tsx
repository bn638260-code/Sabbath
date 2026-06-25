import { interpolate, useCurrentFrame } from "remotion";
import { SceneShell } from "../components/SceneShell";
import { VerseCard } from "../components/VerseCard";
import { Chip } from "../components/Chip";
import { Caption } from "../components/Caption";
import { COLORS, type Orientation } from "../theme";

/** Scene 3 — voice command flips the translation; multilingual chips. */
export const VoiceTranslations: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const portrait = orientation === "portrait";
  const cardWidth = portrait ? 900 : 1180;
  const boxHeight = portrait ? 380 : 300;

  // Crossfade KJV -> Reina-Valera around the "read in Spanish" cue.
  const kjvOpacity = interpolate(frame, [56, 72], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const esOpacity = interpolate(frame, [60, 78], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneShell orientation={orientation} gap={portrait ? 40 : 46}>
      <Caption size={portrait ? 52 : 62} font="display">
        Switch translations <span style={{ color: COLORS.gold }}>by voice.</span>
      </Caption>

      <Chip variant="voice" delay={14} size={portrait ? 32 : 36}>
        🎙 “read in Spanish”
      </Chip>

      <div style={{ position: "relative", width: cardWidth, height: boxHeight }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", opacity: kjvOpacity }}>
          <VerseCard
            width={cardWidth}
            reference="John 3:16"
            translation="KJV"
            text="For God so loved the world, that he gave his only begotten Son…"
          />
        </div>
        <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", opacity: esOpacity }}>
          <VerseCard
            delay={60}
            width={cardWidth}
            reference="Juan 3:16"
            translation="RVR 1909"
            text="Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito…"
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
        {["English", "Español", "Français", "Português"].map((l, i) => (
          <Chip key={l} variant="lang" delay={92 + i * 6} size={portrait ? 28 : 30}>
            {l}
          </Chip>
        ))}
      </div>
    </SceneShell>
  );
};
