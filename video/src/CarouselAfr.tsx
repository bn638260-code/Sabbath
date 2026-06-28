import { Img, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "./theme";
import { SlideShell, SHead, SBody, SChip, SVerseCard } from "./carousel/SlideKit";

const TOTAL = 3;

/** Afrikaans 1933/1953 Bybel — Johannes 3:16 (verbatim from data/sources/Afr1953.json). */
const JOHANNES_3_16 =
  "Want so lief het God die wêreld gehad, dat Hy sy eniggebore Seun gegee het, sodat elkeen wat in Hom glo, nie verlore mag gaan nie, maar die ewige lewe kan hê.";

const LANGS = ["English", "Español", "Français", "Português", "Afrikaans"] as const;

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
      <SHead size={104}>
        Nou in <span style={{ color: COLORS.gold }}>Afrikaans.</span>
      </SHead>
      <SBody size={40}>
        SabbathCue speur Afrikaanse Bybelverse op en wys hulle dadelik op die skerm.
      </SBody>
      <SChip variant="muted" size={30}>Afrikaans Bible detection · now live</SChip>
      <SChip variant="muted" size={28}>swipe →</SChip>
    </SlideShell>
  ),
  // 2 — Proof
  () => (
    <SlideShell index={2} total={TOTAL} gap={40}>
      <SChip variant="detection" size={32}>VERS OPGESPOOR</SChip>
      <SHead size={80}>
        Afrikaanse verse, <span style={{ color: COLORS.gold }}>dadelik op die skerm.</span>
      </SHead>
      <SVerseCard reference="Johannes 3:16" translation="Afr1953" text={JOHANNES_3_16} />
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", maxWidth: 920 }}>
        {LANGS.map((l) => (
          <SChip key={l} variant={l === "Afrikaans" ? "voice" : "lang"} size={28}>
            {l}
          </SChip>
        ))}
      </div>
    </SlideShell>
  ),
  // 3 — CTA
  () => (
    <SlideShell index={3} total={TOTAL} gap={40}>
      <Logo size={120} />
      <SHead size={84}>
        Begin jou <span style={{ color: COLORS.gold }}>14-dae gratis proeftydperk.</span>
      </SHead>
      <SBody size={36}>Gratis · geen kaart nodig · Windows</SBody>
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
        Laai af vir Windows ↓
      </div>
    </SlideShell>
  ),
];

/** One slide per frame; render each as a still via scripts/render-carousel-afr.mjs. */
export const CarouselAfr: React.FC = () => {
  const frame = useCurrentFrame();
  const Slide = SLIDES[Math.min(frame, SLIDES.length - 1)];
  return <Slide />;
};

export const CAROUSEL_AFR_SLIDES = TOTAL;
