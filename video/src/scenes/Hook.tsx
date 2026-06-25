import { SceneShell } from "../components/SceneShell";
import { TranscriptType } from "../components/TranscriptType";
import { VerseCard } from "../components/VerseCard";
import { Chip } from "../components/Chip";
import { Caption } from "../components/Caption";
import { COLORS, type Orientation } from "../theme";

/**
 * Scene 1 — "the moment". One stable centered column (all elements mounted,
 * staggered by delay) so nothing overlaps: transcript types → detection chip
 * + verse card fade in below → tagline lands below that.
 */
export const Hook: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const portrait = orientation === "portrait";
  const cardWidth = portrait ? 900 : 1180;
  return (
    <SceneShell orientation={orientation} gap={portrait ? 40 : 48}>
      <TranscriptType
        text="Turn with me to Romans chapter eight…"
        start={6}
        durationInFrames={60}
        size={portrait ? 40 : 46}
      />

      <Chip variant="detection" delay={78} size={portrait ? 28 : 32}>
        VERSE DETECTED · 96% MATCH
      </Chip>

      <VerseCard
        delay={84}
        width={cardWidth}
        reference="Romans 8:28"
        translation="KJV"
        text="And we know that all things work together for good to them that love God…"
      />

      <Caption delay={165} font="display" size={portrait ? 58 : 72}>
        The verse on screen —{" "}
        <span style={{ color: COLORS.gold }}>before you finish the sentence.</span>
      </Caption>
    </SceneShell>
  );
};
