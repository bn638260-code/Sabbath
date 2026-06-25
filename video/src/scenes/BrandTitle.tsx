import { LogoMark } from "../components/LogoMark";
import { Caption } from "../components/Caption";
import { SceneShell } from "../components/SceneShell";
import { COLORS, type Orientation } from "../theme";

/** Scene 2 — brand reveal. */
export const BrandTitle: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const portrait = orientation === "portrait";
  return (
    <SceneShell orientation={orientation} gap={36}>
      <LogoMark delay={4} size={portrait ? 132 : 156} />
      <Caption delay={20} size={portrait ? 42 : 50} color={COLORS.slate} weight={500}>
        AI scripture detection for live worship.
      </Caption>
    </SceneShell>
  );
};
