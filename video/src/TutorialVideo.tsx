import {
  AbsoluteFill,
  Audio,
  Img,
  Series,
  getStaticFiles,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion"
import { COLORS, FONTS } from "./theme"

const FPS = 30

export const TUTORIAL_DURATION_FRAMES = 144 * FPS

type PanelTone = "neutral" | "gold" | "green" | "dark"
type FeaturePanel = {
  title: string
  body: string
  tone?: PanelTone
}

type MockPanel = {
  title: string
  lines: string[]
  accent?: string
}

const scenes = [
  { component: IntroScene, frames: 270 },
  { component: WorkflowScene, frames: 330 },
  { component: CaptureScene, frames: 420 },
  { component: DetectionScene, frames: 420 },
  { component: SearchScene, frames: 420 },
  { component: QueueScene, frames: 450 },
  { component: ServiceScene, frames: 420 },
  { component: BroadcastScene, frames: 510 },
  { component: LibraryScene, frames: 390 },
  { component: SettingsScene, frames: 450 },
  { component: CloseScene, frames: 240 },
]

const navItems = [
  "Live Desk",
  "Detections",
  "Scripture & EGW",
  "Queue",
  "Run Service",
  "Schedules",
  "Broadcast",
  "Themes",
  "Hymns",
  "Library",
  "Settings",
]

const getProgress = (frame: number, start = 0, end = 90) =>
  interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

const enterStyle = (frame: number, delay = 0, y = 28) => {
  const progress = spring({
    frame: frame - delay,
    fps: FPS,
    config: { damping: 170, stiffness: 90 },
  })
  return {
    opacity: interpolate(progress, [0, 1], [0, 1]),
    transform: `translateY(${interpolate(progress, [0, 1], [y, 0])}px)`,
  }
}

const OptionalMusic: React.FC = () => {
  const hasMusic = getStaticFiles().some(
    (file) => file.name === "tutorial-music.mp3"
  )
  if (!hasMusic) return null
  return <Audio src={staticFile("tutorial-music.mp3")} volume={0.45} />
}

const TutorialShell: React.FC<{
  eyebrow: string
  title: React.ReactNode
  body?: string
  children: React.ReactNode
  sceneNumber: number
}> = ({ eyebrow, title, body, children, sceneNumber }) => {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.bg0} 0%, #ffffff 44%, ${COLORS.bg1} 100%)`,
        color: COLORS.ink,
        fontFamily: FONTS.body,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(780px 420px at 18% 18%, rgba(176,125,36,0.13), transparent 68%), radial-gradient(780px 420px at 86% 82%, rgba(31,157,91,0.11), transparent 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          top: 54,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 24,
          color: COLORS.inkSoft,
          letterSpacing: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Img
            src={staticFile("logo.png")}
            style={{ width: 54, height: 54, objectFit: "contain" }}
          />
          <span
            style={{
              fontFamily: FONTS.display,
              fontSize: 34,
              fontWeight: 600,
              color: COLORS.ink,
            }}
          >
            Sabbath<span style={{ color: COLORS.gold }}>Cue</span>
          </span>
        </div>
        <div style={{ fontWeight: 700 }}>Operator Tutorial</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 72,
          right: 72,
          bottom: 48,
          display: "flex",
          alignItems: "center",
          gap: 18,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 8,
            borderRadius: 999,
            background: "rgba(33,28,21,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${((sceneNumber + getProgress(frame, 0, 120)) / scenes.length) * 100}%`,
              height: "100%",
              borderRadius: 999,
              background: `linear-gradient(90deg, ${COLORS.gold}, ${COLORS.green})`,
            }}
          />
        </div>
        <div
          style={{
            width: 76,
            textAlign: "right",
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.inkSoft,
          }}
        >
          {String(sceneNumber + 1).padStart(2, "0")}/
          {String(scenes.length).padStart(2, "0")}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 88,
          top: 142,
          width: 590,
          ...enterStyle(frame, 4),
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "10px 16px",
            borderRadius: 999,
            background: COLORS.goldSoft,
            border: "1px solid rgba(176,125,36,0.28)",
            color: COLORS.goldDeep,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 0,
          }}
        >
          {eyebrow}
        </div>
        <h1
          style={{
            margin: "26px 0 0",
            fontFamily: FONTS.display,
            fontSize: 74,
            lineHeight: 1.02,
            fontWeight: 600,
            letterSpacing: 0,
            color: COLORS.ink,
          }}
        >
          {title}
        </h1>
        {body ? (
          <p
            style={{
              margin: "24px 0 0",
              fontSize: 28,
              lineHeight: 1.32,
              color: COLORS.inkSoft,
              maxWidth: 560,
              letterSpacing: 0,
            }}
          >
            {body}
          </p>
        ) : null}
      </div>
      <div
        style={{
          position: "absolute",
          left: 730,
          right: 88,
          top: 150,
          bottom: 104,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  )
}

const PanelCard: React.FC<{
  title: string
  children: React.ReactNode
  tone?: PanelTone
  delay?: number
  style?: React.CSSProperties
}> = ({ title, children, tone = "neutral", delay = 0, style }) => {
  const frame = useCurrentFrame()
  const toneStyle = {
    neutral: {
      bg: "rgba(255,255,255,0.86)",
      border: COLORS.line,
      title: COLORS.ink,
    },
    gold: {
      bg: COLORS.goldSoft,
      border: "rgba(176,125,36,0.28)",
      title: COLORS.goldDeep,
    },
    green: {
      bg: COLORS.greenSoft,
      border: "rgba(31,157,91,0.28)",
      title: COLORS.green,
    },
    dark: { bg: "#211C15", border: "rgba(255,255,255,0.14)", title: "#FFFFFF" },
  }[tone]

  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid ${toneStyle.border}`,
        background: toneStyle.bg,
        boxShadow: `0 18px 45px ${COLORS.shadowSoft}`,
        padding: 26,
        ...enterStyle(frame, delay),
        ...style,
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: toneStyle.title,
          letterSpacing: 0,
          marginBottom: 16,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

const FeatureGrid: React.FC<{
  items: FeaturePanel[]
  columns?: number
  delayStep?: number
}> = ({ items, columns = 2, delayStep = 8 }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: 20,
      width: "100%",
      height: "100%",
      alignContent: "center",
    }}
  >
    {items.map((item, index) => (
      <PanelCard
        key={item.title}
        title={item.title}
        tone={item.tone}
        delay={18 + index * delayStep}
      >
        <div
          style={{
            fontSize: 22,
            lineHeight: 1.28,
            color: COLORS.inkSoft,
            letterSpacing: 0,
          }}
        >
          {item.body}
        </div>
      </PanelCard>
    ))}
  </div>
)

const AppFrame: React.FC<{
  active: string
  panels: MockPanel[]
  highlight?: string
  delay?: number
}> = ({ active, panels, highlight, delay = 0 }) => {
  const frame = useCurrentFrame()
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 8,
        overflow: "hidden",
        background: "#F7F4ED",
        border: `1px solid ${COLORS.line}`,
        boxShadow: `0 30px 70px ${COLORS.shadowSoft}`,
        display: "grid",
        gridTemplateRows: "78px 1fr",
        ...enterStyle(frame, delay, 18),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 24px",
          borderBottom: `1px solid ${COLORS.line}`,
          background: "rgba(255,255,255,0.88)",
        }}
      >
        {navItems.slice(0, 8).map((item) => {
          const selected = item === active
          return (
            <div
              key={item}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: selected ? COLORS.ink : "transparent",
                color: selected ? "#FFFFFF" : COLORS.inkSoft,
                fontSize: 17,
                fontWeight: selected ? 800 : 650,
                whiteSpace: "nowrap",
                letterSpacing: 0,
              }}
            >
              {item}
            </div>
          )
        })}
      </div>
      <div
        style={{
          padding: 24,
          display: "grid",
          gridTemplateColumns: panels.length === 2 ? "1fr 1fr" : "1fr 1fr 1fr",
          gap: 18,
          minHeight: 0,
        }}
      >
        {panels.map((panel, index) => {
          const isHighlight = highlight === panel.title
          return (
            <div
              key={panel.title}
              style={{
                borderRadius: 8,
                background: "#FFFFFF",
                border: `2px solid ${isHighlight ? (panel.accent ?? COLORS.gold) : "rgba(33,28,21,0.08)"}`,
                padding: 22,
                display: "flex",
                flexDirection: "column",
                gap: 16,
                boxShadow: isHighlight
                  ? `0 0 0 6px rgba(176,125,36,0.12)`
                  : "none",
                ...enterStyle(frame, delay + 12 + index * 8, 14),
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 850,
                    color: COLORS.ink,
                    letterSpacing: 0,
                  }}
                >
                  {panel.title}
                </div>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: panel.accent ?? COLORS.gold,
                  }}
                />
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {panel.lines.map((line, lineIndex) => (
                  <div
                    key={line}
                    style={{
                      padding: "13px 14px",
                      borderRadius: 8,
                      background:
                        lineIndex === 0
                          ? "rgba(176,125,36,0.10)"
                          : "rgba(33,28,21,0.045)",
                      color: lineIndex === 0 ? COLORS.ink : COLORS.inkSoft,
                      fontSize: 19,
                      lineHeight: 1.18,
                      fontWeight: lineIndex === 0 ? 750 : 600,
                      letterSpacing: 0,
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const StepRail: React.FC<{ steps: string[]; activeIndex?: number }> = ({
  steps,
  activeIndex = 0,
}) => {
  const frame = useCurrentFrame()
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {steps.map((step, index) => {
        const active = index <= activeIndex
        return (
          <div
            key={step}
            style={{
              display: "grid",
              gridTemplateColumns: "52px 1fr",
              alignItems: "center",
              gap: 18,
              ...enterStyle(frame, 16 + index * 10, 16),
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 999,
                background: active ? COLORS.gold : "rgba(33,28,21,0.08)",
                color: active ? "#FFFFFF" : COLORS.inkSoft,
                display: "grid",
                placeItems: "center",
                fontSize: 24,
                fontWeight: 850,
              }}
            >
              {index + 1}
            </div>
            <div
              style={{
                padding: "18px 22px",
                borderRadius: 8,
                background: active ? "#FFFFFF" : "rgba(255,255,255,0.58)",
                border: `1px solid ${active ? "rgba(176,125,36,0.24)" : COLORS.line}`,
                fontSize: 27,
                fontWeight: 800,
                color: COLORS.ink,
                letterSpacing: 0,
              }}
            >
              {step}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function IntroScene() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.bg0} 0%, #FFFFFF 42%, ${COLORS.bg1} 100%)`,
        color: COLORS.ink,
        fontFamily: FONTS.body,
        display: "grid",
        placeItems: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(700px 360px at 28% 28%, rgba(176,125,36,0.18), transparent 70%), radial-gradient(720px 360px at 78% 72%, rgba(31,157,91,0.12), transparent 70%)",
        }}
      />
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          gap: 28,
          ...enterStyle(frame, 4),
        }}
      >
        <Img
          src={staticFile("logo.png")}
          style={{ width: 150, height: 150, objectFit: "contain" }}
        />
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 118,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: 0,
          }}
        >
          Sabbath<span style={{ color: COLORS.gold }}>Cue</span>
        </div>
        <div style={{ fontSize: 42, fontWeight: 800, color: COLORS.ink }}>
          Full operator tutorial
        </div>
        <div
          style={{
            maxWidth: 1200,
            fontSize: 31,
            lineHeight: 1.35,
            color: COLORS.inkSoft,
          }}
        >
          Learn the main path from service setup to live verses on the
          projector, plus search, themes, library, settings, and remote control.
        </div>
      </div>
    </AbsoluteFill>
  )
}

function WorkflowScene() {
  const frame = useCurrentFrame()
  const activeIndex = Math.min(4, Math.floor(frame / 58))
  return (
    <TutorialShell
      eyebrow="Start here"
      title={<>The operator workflow in one pass.</>}
      body="Most services follow the same rhythm: prepare, listen, choose, preview, and send live."
      sceneNumber={1}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 32,
          height: "100%",
          alignItems: "center",
        }}
      >
        <StepRail
          activeIndex={activeIndex}
          steps={[
            "Set up audio and display",
            "Start live transcription",
            "Detect or search for content",
            "Preview and queue items",
            "Present to the live output",
          ]}
        />
        <PanelCard title="Important workspaces" tone="green" delay={20}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            {navItems.map((item, index) => (
              <div
                key={item}
                style={{
                  borderRadius: 8,
                  padding: "13px 14px",
                  background:
                    index <= activeIndex + 2
                      ? "#FFFFFF"
                      : "rgba(255,255,255,0.56)",
                  color: COLORS.ink,
                  fontSize: 19,
                  fontWeight: 750,
                  letterSpacing: 0,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </PanelCard>
      </div>
    </TutorialShell>
  )
}

function CaptureScene() {
  return (
    <TutorialShell
      eyebrow="Live Desk"
      title={<>Start with the microphone and transcript.</>}
      body="Pick the input, set the gain, start transcribing, and keep the Live Desk visible while the service runs."
      sceneNumber={2}
    >
      <AppFrame
        active="Live Desk"
        highlight="Live Transcript"
        panels={[
          {
            title: "Live Transcript",
            accent: COLORS.green,
            lines: [
              "Start transcribing",
              "Speech appears in real time",
              "Verse references are highlighted",
              "Clear or pause when needed",
            ],
          },
          {
            title: "Preview",
            accent: COLORS.gold,
            lines: [
              "Check the next verse",
              "Confirm translation",
              "See slide layout before live",
              "Manual mode keeps control",
            ],
          },
          {
            title: "Live Output",
            accent: "#211C15",
            lines: [
              "Audience display",
              "HDMI projector window",
              "Main output status",
              "Emergency clear available",
            ],
          },
        ]}
      />
    </TutorialShell>
  )
}

function DetectionScene() {
  const frame = useCurrentFrame()
  const autoFill = interpolate(frame, [80, 190], [12, 92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })
  return (
    <TutorialShell
      eyebrow="Detections"
      title={<>Review detected verses before they go live.</>}
      body="Detections can be direct references or semantic matches. Use Present for now, Queue for later, and tune Auto mode in Settings."
      sceneNumber={3}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 26,
          height: "100%",
          alignItems: "center",
        }}
      >
        <AppFrame
          active="Detections"
          highlight="Recent Detections"
          panels={[
            {
              title: "Recent Detections",
              accent: COLORS.green,
              lines: [
                "Romans 8:28 - 96% match",
                "John 3:16 - 91% semantic",
                "Psalm 23:1 - queued",
                "Present or Queue each result",
              ],
            },
            {
              title: "Detection Controls",
              accent: COLORS.gold,
              lines: [
                "Auto or Manual broadcast",
                "Confidence threshold",
                "Semantic detection switch",
                "Translation follows Settings",
              ],
            },
          ]}
        />
        <PanelCard title="Confidence threshold" tone="gold" delay={30}>
          <div style={{ display: "grid", gap: 22 }}>
            <div
              style={{ fontSize: 24, lineHeight: 1.28, color: COLORS.inkSoft }}
            >
              Raise the slider to reduce noise. Lower it when the room is quiet
              and you want more suggestions.
            </div>
            <div
              style={{
                height: 18,
                borderRadius: 999,
                background: "rgba(33,28,21,0.10)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${autoFill}%`,
                  borderRadius: 999,
                  background: COLORS.green,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 21,
                fontWeight: 800,
              }}
            >
              <span>Manual</span>
              <span>Auto Live</span>
            </div>
          </div>
        </PanelCard>
      </div>
    </TutorialShell>
  )
}

function SearchScene() {
  return (
    <TutorialShell
      eyebrow="Scripture & EGW"
      title={<>Find content even when it was not spoken.</>}
      body="Use exact Bible lookup, phrase search, quick navigation, and Ellen White paragraph lookup from the search workspace."
      sceneNumber={4}
    >
      <FeatureGrid
        items={[
          {
            title: "Book search",
            body: "Choose book, chapter, verse, and translation for exact references.",
            tone: "neutral",
          },
          {
            title: "Context search",
            body: "Search by topic or phrase when you remember the idea, not the exact reference.",
            tone: "gold",
          },
          {
            title: "Quick navigation",
            body: "Type shortcuts like J for Joshua or 1 J for 1 John, then tab through chapter and verse.",
            tone: "green",
          },
          {
            title: "EGW lookup",
            body: "Route Ellen White paragraphs through the same preview, queue, and present workflow.",
            tone: "neutral",
          },
        ]}
      />
    </TutorialShell>
  )
}

function QueueScene() {
  return (
    <TutorialShell
      eyebrow="Queue, Preview, Live"
      title={<>Keep the audience output deliberate.</>}
      body="Queue items for later, preview before showing them, then send the correct verse, hymn, slide, image, or paragraph live."
      sceneNumber={5}
    >
      <AppFrame
        active="Queue"
        highlight="Queue"
        panels={[
          {
            title: "Queue",
            accent: COLORS.gold,
            lines: [
              "Drag to reorder",
              "Click to present",
              "Mix scripture, hymns, slides",
              "Build the service set list",
            ],
          },
          {
            title: "Preview",
            accent: COLORS.green,
            lines: [
              "Check exactly what comes next",
              "Review theme and layout",
              "Safe place for manual choices",
              "No audience change yet",
            ],
          },
          {
            title: "Live Output",
            accent: "#211C15",
            lines: [
              "Send to projector",
              "Advance or clear",
              "Use emergency live when needed",
              "Audience sees this surface",
            ],
          },
        ]}
      />
    </TutorialShell>
  )
}

function ServiceScene() {
  return (
    <TutorialShell
      eyebrow="Service Schedules"
      title={<>Prepare the whole service before it starts.</>}
      body="Service plans organize the running order, hymns, sermon slides, scripture references, checklist items, and media attachments."
      sceneNumber={6}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "0.9fr 1.1fr",
          gap: 28,
          height: "100%",
          alignItems: "center",
        }}
      >
        <PanelCard title="Service plan" delay={10}>
          <div style={{ display: "grid", gap: 14 }}>
            {[
              "Welcome",
              "Opening hymn",
              "Scripture reading",
              "Sermon",
              "Closing hymn",
            ].map((item, index) => (
              <div
                key={item}
                style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr",
                  gap: 14,
                  alignItems: "center",
                  padding: "15px 16px",
                  borderRadius: 8,
                  background:
                    index === 3 ? COLORS.goldSoft : "rgba(33,28,21,0.045)",
                  fontSize: 22,
                  fontWeight: 800,
                  color: COLORS.ink,
                }}
              >
                <span style={{ color: COLORS.goldDeep }}>{index + 1}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </PanelCard>
        <FeatureGrid
          columns={1}
          items={[
            {
              title: "Run Service Flow",
              body: "Follow the schedule live and move through prepared items in order.",
              tone: "green",
            },
            {
              title: "Preparation checks",
              body: "Attach slides, hymns, readings, notes, and media before the operator is under pressure.",
              tone: "gold",
            },
            {
              title: "One live path",
              body: "Prepared content still goes through preview, queue, and live output.",
              tone: "neutral",
            },
          ]}
        />
      </div>
    </TutorialShell>
  )
}

function BroadcastScene() {
  const frame = useCurrentFrame()
  const pulse = interpolate(Math.sin(frame / 12), [-1, 1], [0.28, 1])
  return (
    <TutorialShell
      eyebrow="Broadcast Control"
      title={<>Set the projector and output screens.</>}
      body="Projector Setup is the quick path. Broadcast Settings is the advanced path for main and alternate outputs."
      sceneNumber={7}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 26,
          height: "100%",
          alignItems: "center",
        }}
      >
        <PanelCard title="Projector setup" tone="green" delay={8}>
          <div style={{ position: "relative", height: 360 }}>
            <div
              style={{
                position: "absolute",
                left: 20,
                top: 38,
                width: 260,
                height: 170,
                borderRadius: 8,
                background: "#FFFFFF",
                border: `3px solid ${COLORS.ink}`,
                display: "grid",
                placeItems: "center",
                fontSize: 64,
                fontWeight: 900,
              }}
            >
              1
            </div>
            <div
              style={{
                position: "absolute",
                right: 20,
                bottom: 38,
                width: 310,
                height: 190,
                borderRadius: 8,
                background: COLORS.ink,
                color: "#FFFFFF",
                border: `3px solid ${COLORS.gold}`,
                display: "grid",
                placeItems: "center",
                fontSize: 74,
                fontWeight: 900,
                boxShadow: `0 0 ${30 + pulse * 24}px rgba(176,125,36,0.45)`,
              }}
            >
              2
            </div>
            <div
              style={{
                position: "absolute",
                left: 44,
                bottom: 22,
                fontSize: 23,
                lineHeight: 1.28,
                fontWeight: 750,
                color: COLORS.inkSoft,
                width: 300,
              }}
            >
              Flash screen numbers, choose the projector, and use Extend display
              mode.
            </div>
          </div>
        </PanelCard>
        <FeatureGrid
          columns={1}
          items={[
            {
              title: "Main output",
              body: "Choose monitor, theme, preview window, and fullscreen output before switching it on.",
              tone: "gold",
            },
            {
              title: "Alternate output",
              body: "Send a second independent output to a stage display or overflow room.",
              tone: "neutral",
            },
            {
              title: "Theme designer",
              body: "Control fonts, backgrounds, lower thirds, slide positioning, and live-output style.",
              tone: "green",
            },
          ]}
        />
      </div>
    </TutorialShell>
  )
}

function LibraryScene() {
  return (
    <TutorialShell
      eyebrow="Themes, Hymns, Library"
      title={<>Store reusable service content.</>}
      body="The supporting workspaces keep hymns, images, songs, slide templates, media, and motion themes ready for the live desk."
      sceneNumber={8}
    >
      <FeatureGrid
        items={[
          {
            title: "Kinetic Themes",
            body: "Use animated visual themes for modern scripture slides and live displays.",
            tone: "gold",
          },
          {
            title: "SDA Hymns Search",
            body: "Find hymn lyrics and prepare hymn slides for the queue or service plan.",
            tone: "green",
          },
          {
            title: "Church Library",
            body: "Organize reusable images, songs, slide templates, and media assets.",
            tone: "neutral",
          },
          {
            title: "Media controls",
            body: "Preview media, attach it to service items, and keep live output intentional.",
            tone: "neutral",
          },
        ]}
      />
    </TutorialShell>
  )
}

function SettingsScene() {
  return (
    <TutorialShell
      eyebrow="System Settings"
      title={<>Configure the app before service.</>}
      body="Settings is where the operator locks in device choices, Bible behavior, automation, account status, support, and updates."
      sceneNumber={9}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          height: "100%",
          alignContent: "center",
        }}
      >
        {[
          ["Audio", "Microphone feed and input gain."],
          ["Speech", "Local Vosk or cloud Deepgram and Soniox keys."],
          ["Bible", "Active translation for detections, search, and output."],
          [
            "Display Mode",
            "Auto or Manual live behavior plus semantic threshold.",
          ],
          ["Remote Control", "OSC and HTTP control for local AV automation."],
          [
            "Help, Account, Updates",
            "Tutorial restart, support, shortcuts, account, and app updates.",
          ],
        ].map(([title, body], index) => (
          <PanelCard
            key={title}
            title={title}
            tone={
              index % 3 === 0 ? "gold" : index % 3 === 1 ? "green" : "neutral"
            }
            delay={16 + index * 7}
            style={{ minHeight: 150 }}
          >
            <div
              style={{ fontSize: 22, lineHeight: 1.28, color: COLORS.inkSoft }}
            >
              {body}
            </div>
          </PanelCard>
        ))}
      </div>
    </TutorialShell>
  )
}

function CloseScene() {
  const frame = useCurrentFrame()
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${COLORS.ink} 0%, #30271B 58%, ${COLORS.goldDeep} 100%)`,
        color: "#FFFFFF",
        fontFamily: FONTS.body,
        display: "grid",
        gridTemplateColumns: "0.9fr 1.1fr",
        gap: 60,
        alignItems: "center",
        padding: 110,
      }}
    >
      <div style={{ ...enterStyle(frame, 4) }}>
        <Img
          src={staticFile("logo.png")}
          style={{
            width: 140,
            height: 140,
            objectFit: "contain",
            marginBottom: 28,
          }}
        />
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 86,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: 0,
          }}
        >
          First service run
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 30,
            lineHeight: 1.35,
            color: "rgba(255,255,255,0.78)",
          }}
        >
          Start small: verify audio, connect the projector, speak one verse
          reference, preview it, then present.
        </div>
      </div>
      <div style={{ display: "grid", gap: 18 }}>
        {[
          "Open Projector Setup",
          "Check Audio and Speech settings",
          "Start Live Transcript",
          "Queue or Present a detected verse",
          "Restart this tutorial from Settings > Help",
        ].map((step, index) => (
          <div
            key={step}
            style={{
              display: "grid",
              gridTemplateColumns: "54px 1fr",
              gap: 18,
              alignItems: "center",
              padding: "20px 24px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.18)",
              fontSize: 27,
              fontWeight: 800,
              ...enterStyle(frame, 16 + index * 10, 18),
            }}
          >
            <span
              style={{
                width: 54,
                height: 54,
                borderRadius: 999,
                background: COLORS.gold,
                display: "grid",
                placeItems: "center",
              }}
            >
              {index + 1}
            </span>
            <span>{step}</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  )
}

export const TutorialVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg0 }}>
      <Series>
        {scenes.map(({ component: Scene, frames }, index) => (
          <Series.Sequence key={index} durationInFrames={frames}>
            <Scene />
          </Series.Sequence>
        ))}
      </Series>
      <OptionalMusic />
    </AbsoluteFill>
  )
}
