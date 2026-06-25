import { Composition } from "remotion";
import { Film } from "./Film";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LaunchFilm"
        component={Film}
        durationInFrames={75 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ orientation: "landscape" as const }}
      />
      <Composition
        id="SocialCut"
        component={Film}
        durationInFrames={30 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ orientation: "portrait" as const }}
      />
    </>
  );
};
