import type { Step } from "react-joyride"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"
import { openSettings, type SettingsSection } from "@/lib/settings-dialog"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"

const STEP_DEFAULTS = {
  skipBeacon: true,
} as const satisfies Partial<Step>

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function waitForTarget(
  selector: string,
  timeoutMs = 2500
): Promise<Element | null> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const element = document.querySelector(selector)
    if (element) return element
    await wait(50)
  }

  return document.querySelector(selector)
}

async function prepareTarget(
  selector: string,
  options?: { workspace?: "live"; settingsSection?: SettingsSection }
): Promise<void> {
  if (options?.settingsSection) {
    openSettings(options.settingsSection)
  } else if (options?.workspace === "live") {
    useServicePlanStore.getState().closePlanner()
    useDashboardWorkspaceStore.getState().setWorkspace("live")
  }

  await wait(0)
  const target = await waitForTarget(selector)
  target?.scrollIntoView({ block: "center", inline: "center" })
  await wait(80)
}

const liveStep = (selector: string) => ({
  before: () => prepareTarget(selector, { workspace: "live" }),
})

export const TUTORIAL_STEPS: Step[] = [
  {
    ...STEP_DEFAULTS,
    target: "body",
    title: `Welcome to ${APP_DISPLAY_NAME}`,
    content: `${APP_DISPLAY_NAME} listens to your sermon, detects Bible verses as they are spoken, and presents them on screen for your congregation. This quick tour shows you around - it takes about a minute. You can skip it and restart it later from Settings > Help.`,
    placement: "center",
    before: () => prepareTarget("body", { workspace: "live" }),
  },
  {
    ...STEP_DEFAULTS,
    ...liveStep('[data-slot="transcript-panel"]'),
    target: '[data-slot="transcript-panel"]',
    title: "Live Transcript",
    content:
      "Start transcribing to convert speech to text in real time. Detected Bible verses are highlighted automatically.",
    placement: "right",
  },
  {
    ...STEP_DEFAULTS,
    ...liveStep('[data-slot="detections-panel"]'),
    target: '[data-slot="detections-panel"]',
    title: "AI Detections",
    content:
      "Detected verses appear here. Press Present to display a verse on screen, or Queue to save it for later.",
    placement: "left",
  },
  {
    ...STEP_DEFAULTS,
    ...liveStep('[data-tour="book-search"]'),
    target: '[data-tour="book-search"]',
    title: "Book Search",
    content:
      "Look up any verse by book, chapter, and number. Switch translations from the dropdown.",
    placement: "bottom",
    spotlightPadding: 2,
  },
  {
    ...STEP_DEFAULTS,
    ...liveStep('[data-tour="context-search"]'),
    target: '[data-tour="context-search"]',
    title: "Context Search",
    content: `Search by phrase or topic. ${APP_DISPLAY_NAME} uses AI to find matching verses.`,
    placement: "bottom",
    spotlightPadding: 2,
  },
  {
    ...STEP_DEFAULTS,
    ...liveStep('[data-tour="quick-nav"]'),
    target: '[data-tour="quick-nav"]',
    title: "Quick Navigation",
    content:
      "Type to instantly navigate: 'J' -> 'Joshua' or '1 J' -> '1 John', press Tab to advance stages, then type chapter and verse.",
    placement: "bottom",
    spotlightPadding: 2,
  },
  {
    ...STEP_DEFAULTS,
    ...liveStep('[data-slot="queue-panel"]'),
    target: '[data-slot="queue-panel"]',
    title: "Verse Queue",
    content:
      "Your queued verses live here. Drag to reorder, click to present. Build your set list before going live.",
    placement: "left",
  },
  {
    ...STEP_DEFAULTS,
    ...liveStep('[data-slot="preview-panel"]'),
    target: '[data-slot="preview-panel"]',
    title: "Programme Preview",
    content:
      "Preview how verses will look before going live. What you see here is what your audience sees.",
    placement: "bottom",
  },
  {
    ...STEP_DEFAULTS,
    ...liveStep('[data-slot="live-output-panel"]'),
    target: '[data-slot="live-output-panel"]',
    title: "Live Display",
    content:
      "The live output. Presented verses appear here and on connected displays or NDI outputs.",
    placement: "bottom",
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="broadcast"]',
    title: "Broadcast",
    content:
      "Open Broadcast Control to configure NDI output, display windows, and resolution for your production setup.",
    placement: "right",
  },
  {
    ...STEP_DEFAULTS,
    ...liveStep('[data-tour="theme"]'),
    target: '[data-tour="theme"]',
    title: "Themes",
    content:
      "Pick an accent from the header swatches, or open Theme designer from Broadcast Control for full slide styling.",
    placement: "bottom",
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="settings"]',
    title: "Settings",
    content:
      "Open System Settings in the top navigation to configure audio, Bible translations, display mode, remote control, and API keys.",
    placement: "left",
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="settings-section-speech"]',
    title: "Cloud API keys",
    content:
      "Deepgram and Gladia require your own paid third-party accounts; they are not free or included with SabbathCue. Create an account with the provider, generate an API key in that provider's dashboard, then paste it in Settings > Speech Recognition before choosing that cloud provider.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="settings-section-speech"]', {
        settingsSection: "speech",
      }),
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="settings-section-account"]',
    title: "Your Account",
    content:
      "Settings > Account shows the email you signed in with. From there you can sign out, manage your account, and your sign-in works on up to 2 machines.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="settings-section-account"]', {
        settingsSection: "account",
      }),
  },
  {
    ...STEP_DEFAULTS,
    target: "body",
    title: "You're all set",
    content:
      "A good first run: start transcribing, speak a verse reference out loud, and press Present when it appears. Revisit this tour anytime from Settings > Help > Restart.",
    placement: "center",
    before: () => prepareTarget("body", { workspace: "live" }),
  },
]
