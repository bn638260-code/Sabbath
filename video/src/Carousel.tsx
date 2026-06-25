import { Img, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "./theme";
import { SlideShell, SHead, SBody, SChip, SVerseCard } from "./carousel/SlideKit";

const TOTAL = 7;

const Logo: React.FC<{ size?: number }> = ({ size = 120 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
    <Img src={staticFile("logo.png")} style={{ width: size, height: size, objectFit: "contain" }} />
    <span style={{ fontFamily: FONTS.display, fontSize: size * 0.78, fontWeight: 600, color: COLORS.ink, letterSpacing: -1 }}>
      Sabbath<span style={{ color: COLORS.gold }}>Cue</span>
    </span>
  </div>
);

const Step: React.FC<{ n: number; title: string; body: string }> = ({ n, title, body }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 28, width: 800, textAlign: "left" }}>
    <div
      style={{
        flexShrink: 0,
        width: 92,
        height: 92,
        borderRadius: 24,
        background: COLORS.goldSoft,
        border: `2px solid ${COLORS.gold}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONTS.display,
        fontSize: 48,
        fontWeight: 600,
        color: COLORS.goldDeep,
      }}
    >
      {n}
    </div>
    <div>
      <div style={{ fontFamily: FONTS.body, fontSize: 42, fontWeight: 700, color: COLORS.ink }}>{title}</div>
      <div style={{ fontFamily: FONTS.body, fontSize: 32, fontWeight: 500, color: COLORS.inkSoft, marginTop: 4 }}>
        {body}
      </div>
    </div>
  </div>
);

const SLIDES: React.FC[] = [
  // 1 — Cover
  () => (
    <SlideShell index={1} total={TOTAL} gap={56}>
      <Logo size={132} />
      <SHead size={96}>
        The verse on screen — <span style={{ color: COLORS.gold }}>before you finish the sentence.</span>
      </SHead>
      <SBody size={40}>AI scripture detection for live worship.</SBody>
      <SChip variant="muted" size={30}>swipe →</SChip>
    </SlideShell>
  ),
  // 2 — Problem
  () => (
    <SlideShell index={2} total={TOTAL} gap={44}>
      <SChip variant="muted" size={30}>THE BOOTH, EVERY WEEK</SChip>
      <SHead size={86}>The scramble is real.</SHead>
      <SBody size={42}>
        The pastor names a verse. Your operator dives for the reference, types it, mistypes it — and the moment
        has already passed.
      </SBody>
    </SlideShell>
  ),
  // 3 — How it works
  () => (
    <SlideShell index={3} total={TOTAL} gap={44}>
      <SHead size={80}>From spoken word to live screen.</SHead>
      <div style={{ display: "flex", flexDirection: "column", gap: 30, marginTop: 8 }}>
        <Step n={1} title="Listen" body="Captures the pulpit mic in real time." />
        <Step n={2} title="Detect" body="AI matches the spoken reference or quote." />
        <Step n={3} title="Display" body="The verse appears on your broadcast output." />
      </div>
    </SlideShell>
  ),
  // 4 — Voice + multilingual
  () => (
    <SlideShell index={4} total={TOTAL} gap={40}>
      <SHead size={78}>
        Switch translations <span style={{ color: COLORS.gold }}>by voice.</span>
      </SHead>
      <SChip variant="voice" size={34}>🎙 “read in Spanish”</SChip>
      <SVerseCard
        reference="Juan 3:16"
        translation="RVR 1909"
        text="Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito…"
      />
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
        {["English", "Español", "Français", "Português"].map((l) => (
          <SChip key={l} variant="lang" size={28}>{l}</SChip>
        ))}
      </div>
    </SlideShell>
  ),
  // 5 — Reading mode
  () => (
    <SlideShell index={5} total={TOTAL} gap={40}>
      <SHead size={80}>
        Reading a chapter? <span style={{ color: COLORS.gold }}>It follows along.</span>
      </SHead>
      <div
        style={{
          width: 860,
          background: COLORS.panel,
          borderRadius: 24,
          border: `1px solid ${COLORS.line}`,
          boxShadow: `0 30px 80px ${COLORS.shadowSoft}`,
          padding: 26,
          textAlign: "left",
        }}
      >
        {[
          { r: "8:1", t: "There is therefore now no condemnation…", on: false },
          { r: "8:2", t: "For the law of the Spirit of life…", on: false },
          { r: "8:3", t: "For what the law could not do…", on: true },
          { r: "8:4", t: "That the righteousness of the law…", on: false },
        ].map((v) => (
          <div
            key={v.r}
            style={{
              display: "flex",
              gap: 18,
              alignItems: "center",
              padding: "16px 18px",
              borderRadius: 14,
              background: v.on ? COLORS.goldSoft : "transparent",
              border: v.on ? `1px solid rgba(176,125,36,0.30)` : "1px solid transparent",
            }}
          >
            <span style={{ fontFamily: FONTS.display, fontSize: 30, fontWeight: 600, color: v.on ? COLORS.goldDeep : COLORS.slate, width: 70 }}>
              {v.r}
            </span>
            <span style={{ fontFamily: FONTS.body, fontSize: 30, fontWeight: v.on ? 600 : 500, color: v.on ? COLORS.ink : COLORS.inkSoft }}>
              {v.t}
            </span>
          </div>
        ))}
      </div>
      <SChip variant="voice" size={32}>🎙 “next verse”</SChip>
    </SlideShell>
  ),
  // 6 — Local-first
  () => (
    <SlideShell index={6} total={TOTAL} gap={44}>
      <SHead size={80}>
        Runs on your booth PC. <span style={{ color: COLORS.gold }}>No GPU, no cloud.</span>
      </SHead>
      <div
        style={{
          width: 220,
          height: 220,
          borderRadius: 34,
          background: COLORS.panel,
          border: `3px solid ${COLORS.gold}`,
          boxShadow: `0 0 50px ${COLORS.shadowGold}, 0 24px 60px ${COLORS.shadowSoft}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: FONTS.display, fontSize: 60, fontWeight: 600, color: COLORS.goldDeep }}>CPU</span>
        <span style={{ fontFamily: FONTS.body, fontSize: 22, fontWeight: 700, letterSpacing: 2, color: COLORS.slate }}>
          ON-DEVICE
        </span>
      </div>
      <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", maxWidth: 760 }}>
        {["CPU-only", "No GPU", "Works offline", "Private"].map((t) => (
          <SChip key={t} variant="muted" size={32}>{t}</SChip>
        ))}
      </div>
    </SlideShell>
  ),
  // 7 — CTA
  () => (
    <SlideShell index={7} total={TOTAL} gap={40}>
      <Logo size={120} />
      <SHead size={82}>
        Start your <span style={{ color: COLORS.gold }}>14-day free trial</span>
      </SHead>
      <SBody size={36}>Free · no card · Windows</SBody>
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
      <SBody size={34}>
        <span style={{ color: COLORS.goldDeep, fontWeight: 600 }}>sabbathcue.app</span>
      </SBody>
    </SlideShell>
  ),
];

/** One slide per frame; render each as a still via scripts/render-carousel.mjs. */
export const Carousel: React.FC = () => {
  const frame = useCurrentFrame();
  const Slide = SLIDES[Math.min(frame, SLIDES.length - 1)];
  return <Slide />;
};

export const CAROUSEL_SLIDES = TOTAL;
