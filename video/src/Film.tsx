import { AbsoluteFill, Audio, Series, staticFile, getStaticFiles } from "remotion";
import { COLORS, type Orientation } from "./theme";
import { Hook } from "./scenes/Hook";
import { BrandTitle } from "./scenes/BrandTitle";
import { VoiceTranslations } from "./scenes/VoiceTranslations";
import { ReadingMode } from "./scenes/ReadingMode";
import { LocalFirst } from "./scenes/LocalFirst";
import { CTA } from "./scenes/CTA";

/** Optional background music — renders silently when public/music.mp3 is absent. */
const Music: React.FC = () => {
  const hasMusic = getStaticFiles().some((f) => f.name === "music.mp3");
  if (!hasMusic) return null;
  return <Audio src={staticFile("music.mp3")} volume={0.6} />;
};

type SceneDef = { component: React.FC<{ orientation: Orientation }>; frames: number };

// Landscape: full 6-scene film (~75s @30fps = 2250 frames).
const LANDSCAPE: SceneDef[] = [
  { component: Hook, frames: 420 },
  { component: BrandTitle, frames: 180 },
  { component: VoiceTranslations, frames: 420 },
  { component: ReadingMode, frames: 360 },
  { component: LocalFirst, frames: 420 },
  { component: CTA, frames: 450 },
];

// Portrait: punchy social cut (~30s @30fps = 900 frames).
const PORTRAIT: SceneDef[] = [
  { component: Hook, frames: 240 },
  { component: VoiceTranslations, frames: 240 },
  { component: ReadingMode, frames: 180 },
  { component: CTA, frames: 240 },
];

export const Film: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const scenes = orientation === "portrait" ? PORTRAIT : LANDSCAPE;
  return (
    <AbsoluteFill style={{ background: COLORS.bg0 }}>
      <Series>
        {scenes.map(({ component: Scene, frames }, i) => (
          <Series.Sequence key={i} durationInFrames={frames}>
            <Scene orientation={orientation} />
          </Series.Sequence>
        ))}
      </Series>
      <Music />
    </AbsoluteFill>
  );
};
