import { Img, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "./theme";
import { SlideShell, SHead, SBody, SChip, SVerseCard } from "./carousel/SlideKit";

const TOTAL = 4;

/** The ten nature scenes shipped in the kinetic-backgrounds update. */
const SCENES = [
  "Whispering Foliage",
  "Forest Sanctuary",
  "Gentle Rain",
  "Autumn Fall",
  "Cherry Blossom",
  "Quiet Snowfall",
  "Fireflies & Mist",
  "Starlit Night",
  "Golden Meadow",
  "Northern Aurora",
] as const;

const Logo: React.FC<{ size?: number }> = ({ size = 120 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
    <Img src={staticFile("logo.png")} style={{ width: size, height: size, objectFit: "contain" }} />
    <span style={{ fontFamily: FONTS.display, fontSize: size * 0.78, fontWeight: 600, color: COLORS.ink, letterSpacing: -1 }}>
      Sabbath<span style={{ color: COLORS.gold }}>Cue</span>
    </span>
  </div>
);

const SLIDES: React.FC[] = [
  // 1 — Cover
  () => (
    <SlideShell index={1} total={TOTAL} gap={50}>
      <Logo size={128} />
      <SHead size={100}>
        Cinematic <span style={{ color: COLORS.gold }}>kinetic backgrounds.</span>
      </SHead>
      <SBody size={40}>
        Ten nature themes drift gently behind your verse — rain, snowfall, falling
        leaves, fireflies, starlight and aurora.
      </SBody>
      <SChip variant="muted" size={30}>New in SabbathCue</SChip>
      <SChip variant="muted" size={28}>swipe →</SChip>
    </SlideShell>
  ),
  // 2 — The ten scenes
  () => (
    <SlideShell index={2} total={TOTAL} gap={40}>
      <SChip variant="detection" size={32}>10 NEW SCENES</SChip>
      <SHead size={76}>
        A scene for every <span style={{ color: COLORS.gold }}>Sabbath mood.</span>
      </SHead>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", maxWidth: 940 }}>
        {SCENES.map((scene, i) => (
          <SChip key={scene} variant={i % 3 === 0 ? "voice" : "lang"} size={27}>
            {scene}
          </SChip>
        ))}
      </div>
    </SlideShell>
  ),
  // 3 — The verse stays the hero
  () => (
    <SlideShell index={3} total={TOTAL} gap={40}>
      <SChip variant="voice" size={32}>BIG, LEGIBLE TYPE</SChip>
      <SHead size={72}>
        The verse stays the <span style={{ color: COLORS.gold }}>hero.</span>
      </SHead>
      <SVerseCard
        reference="Psalm 96:1"
        translation="KJV"
        text="O sing unto the Lord a new song: sing unto the Lord, all the earth."
      />
      <SBody size={34}>Each scene pairs with a bold display font. GPU-light and fully offline.</SBody>
    </SlideShell>
  ),
  // 4 — CTA
  () => (
    <SlideShell index={4} total={TOTAL} gap={40}>
      <Logo size={120} />
      <SHead size={84}>
        Update free. <span style={{ color: COLORS.gold }}>Start your 14-day trial.</span>
      </SHead>
      <SBody size={36}>Free · no card required · Windows</SBody>
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 40,
          fontWeight: 700,
          color: "#FFFFFF",
          background: `linear-gradient(180deg, ${COLORS.gold}, ${COLORS.goldDeep})`,
          padding: "22px 50px",
          borderRadius: 16,
          boxShadow: `0 20px 50px ${COLORS.shadowGold}`,
        }}
      >
        Download for Windows ↓
      </div>
    </SlideShell>
  ),
];

/** One slide per frame; render each as a still via scripts/render-carousel-kinetic.mjs. */
export const CarouselKinetic: React.FC = () => {
  const frame = useCurrentFrame();
  const Slide = SLIDES[Math.min(frame, SLIDES.length - 1)];
  return <Slide />;
};

export const CAROUSEL_KINETIC_SLIDES = TOTAL;
