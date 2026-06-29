import type { Step } from "react-joyride"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"
import { openSettings, type SettingsSection } from "@/lib/settings-dialog"
import {
  useDashboardWorkspaceStore,
  type DashboardWorkspace,
} from "@/stores/dashboard-workspace-store"
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
  options?: { workspace?: DashboardWorkspace; settingsSection?: SettingsSection }
): Promise<void> {
  if (options?.settingsSection) {
    openSettings(options.settingsSection)
  } else if (options?.workspace) {
    useServicePlanStore.getState().closePlanner()
    useDashboardWorkspaceStore.getState().setWorkspace(options.workspace)
  }

  await wait(0)
  const target = await waitForTarget(selector)
  target?.scrollIntoView({ block: "center", inline: "center" })
  await wait(80)
}

const liveStep = (selector: string) => ({
  before: () => prepareTarget(selector, { workspace: "live" }),
})

const workspaceStep = (selector: string, workspace: DashboardWorkspace) => ({
  before: () => prepareTarget(selector, { workspace }),
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
    ...workspaceStep('[data-slot="detections-panel"]', "detections"),
    target: '[data-slot="detections-panel"]',
    title: "AI Detections",
    content:
      "Detected verses appear here. Press Present to display a verse on screen, or Queue to save it for later.",
    placement: "left",
  },
  {
    ...STEP_DEFAULTS,
    ...workspaceStep('[data-tour="book-search"]', "scripture-search"),
    target: '[data-tour="book-search"]',
    title: "Book Search",
    content:
      "Look up any verse by book, chapter, and number. Switch translations from the dropdown.",
    placement: "bottom",
    spotlightPadding: 2,
  },
  {
    ...STEP_DEFAULTS,
    ...workspaceStep('[data-tour="context-search"]', "scripture-search"),
    target: '[data-tour="context-search"]',
    title: "Context Search",
    content: `Search by phrase or topic. ${APP_DISPLAY_NAME} uses AI to find matching verses.`,
    placement: "bottom",
    spotlightPadding: 2,
  },
  {
    ...STEP_DEFAULTS,
    ...workspaceStep('[data-tour="quick-nav"]', "scripture-search"),
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
      "The live output. Presented verses appear here and on connected HDMI displays.",
    placement: "bottom",
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="broadcast"]',
    title: "Broadcast",
    content:
      "Open Broadcast Control to configure HDMI display windows, fullscreen projector output, and themes. NDI is coming soon.",
    placement: "right",
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="settings-section-broadcast"]',
    title: "HDMI Projector Setup",
    content:
      "Connect the projector or TV by HDMI, set Windows display mode to Extend, then use Broadcast Settings to Refresh displays, select the HDMI monitor, turn on fullscreen projector output, and open Preview before service.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="settings-section-broadcast"]', {
        settingsSection: "broadcast",
      }),
  },
  {
    ...STEP_DEFAULTS,
    ...liveStep('[data-tour="theme"]'),
    target: '[data-tour="theme"]',
    title: "Themes",
    content:
      "Use the header theme selector to switch the app accent quickly. For the live screen, open Theme Settings or Broadcast Control > Theme designer to adjust fonts, backgrounds, lower thirds, and slide positioning.",
    placement: "bottom",
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="settings-section-themes"]',
    title: "Theme Designer",
    content:
      "Open Theme Settings when you want deeper live-output styling. The designer controls how verses look on the HDMI/projector screen, not just the controller accent.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="settings-section-themes"]', {
        settingsSection: "themes",
      }),
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
      "Deepgram and Gladia require your own paid third-party accounts; they are not free or included with SabbathCue. Create an account with the provider, generate an API key in that provider's dashboard, then paste it into the key field in Settings > Speech Recognition, press Save, and choose that cloud provider. Vosk is local and does not need an API key.",
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
      "Settings > Account shows the email you signed in with. From there you can sign out, request subscription cancellation, or delete your account. Cancellation has no refund for the current paid period; access stays active until the subscribed period ends, then disables unless renewed.",
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
