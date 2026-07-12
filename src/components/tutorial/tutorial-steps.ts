import type { Step } from "react-joyride"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"
import { useBroadcastSettingsDialogStore } from "@/lib/broadcast-settings-dialog"
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
  options?: {
    workspace?: DashboardWorkspace
    settingsSection?: SettingsSection
    broadcastDialog?: boolean
  }
): Promise<void> {
  if (options?.settingsSection) {
    openSettings(options.settingsSection)
  } else if (options?.workspace) {
    useServicePlanStore.getState().closePlanner()
    useDashboardWorkspaceStore.getState().setWorkspace(options.workspace)
  }
  useBroadcastSettingsDialogStore
    .getState()
    .setOpen(Boolean(options?.broadcastDialog))

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

const broadcastDialogStep = (selector: string) => ({
  before: () =>
    prepareTarget(selector, {
      settingsSection: "broadcast",
      broadcastDialog: true,
    }),
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
    target: '[data-tour="projector-setup"]',
    title: "Projector Setup",
    content:
      "Tap here before the service to get the projector working. It remembers last week's screen and goes live in one tap, notices when you plug the projector in, and can flash a big number on each screen so you know which one is the projector. If the projector mirrors your laptop, it tells you to press Win+P and choose Extend.",
    placement: "bottom",
    before: () =>
      prepareTarget('[data-tour="projector-setup"]', { workspace: "live" }),
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
      "For the quickest setup, use Projector Setup in the top bar. Broadcast Settings here is the advanced path: it configures two independent outputs (Main and Alt) with their own themes and target monitors. Set Windows display mode to Extend, then Refresh displays, pick the HDMI monitor, and turn on fullscreen projector output.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="settings-section-broadcast"]', {
        settingsSection: "broadcast",
      }),
  },
  {
    ...STEP_DEFAULTS,
    ...broadcastDialogStep('[data-tour="broadcast-output-main"]'),
    target: '[data-tour="broadcast-output-main"]',
    title: "Main Output",
    content:
      "Broadcast outputs start Off. Choose the theme and output type here, then flip the switch to On when everything is ready - nothing shows to the audience until you switch it on.",
    placement: "right",
  },
  {
    ...STEP_DEFAULTS,
    ...broadcastDialogStep('[data-tour="broadcast-monitor-main"]'),
    target: '[data-tour="broadcast-monitor-main"]',
    title: "Target Monitor",
    content:
      "Press Refresh after connecting the HDMI cable so newly detected displays appear, select the projector monitor, then use Open Preview to check the output before switching it on.",
    placement: "right",
  },
  {
    ...STEP_DEFAULTS,
    ...broadcastDialogStep('[data-tour="broadcast-output-alt"]'),
    target: '[data-tour="broadcast-output-alt"]',
    title: "Alternate Output",
    content:
      "A second, independent output with its own theme and target monitor - useful for a stage display or an overflow room.",
    placement: "left",
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
    target: '[data-tour="settings-section-audio"]',
    title: "Audio Input",
    content:
      "Settings > Audio is where you pick the microphone feed and adjust input gain. The selected device persists across sessions; leave it on System default to follow Windows audio routing. Set gain so speech is clear without clipping.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="settings-section-audio"]', {
        settingsSection: "audio",
      }),
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="settings-section-speech"]',
    title: "Cloud API keys",
    content:
      "Deepgram and Soniox require your own paid third-party accounts; they are not free or included with SabbathCue. Create an account with the provider, generate an API key in that provider's dashboard, then paste it into the key field in Settings > Speech Recognition, press Save, and choose that cloud provider. Vosk is local and does not need an API key.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="settings-section-speech"]', {
        settingsSection: "speech",
      }),
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="settings-section-bible"]',
    title: "Bible Translation",
    content:
      "Settings > Bible selects the active translation used for detections, search, and the live display. Changing it refreshes the verse currently on the live output.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="settings-section-bible"]', {
        settingsSection: "bible",
      }),
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="settings-section-display"]',
    title: "Display Mode",
    content:
      "Settings > Display Mode switches between Auto and Manual broadcast. Auto sends the highest-confidence detected verse straight to the live output; Manual waits for you to present. Semantic detection has its own switch and confidence threshold.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="settings-section-display"]', {
        settingsSection: "display",
      }),
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="settings-section-remote"]',
    title: "Remote Control",
    content:
      "Settings > Remote Control lets local controllers and scripts drive the app. Start the OSC listener for local lighting/AV integrations, or the HTTP API with its access token for local automation. The command log shows incoming remote commands.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="settings-section-remote"]', {
        settingsSection: "remote",
      }),
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="settings-section-api-keys"]',
    title: "API Key Status",
    content:
      "Settings > API Keys shows at a glance whether your Deepgram and Soniox keys are configured. Keys are entered and saved in the Speech Recognition section; no key is needed when using local Vosk.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="settings-section-api-keys"]', {
        settingsSection: "api-keys",
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
    target: '[data-tour="settings-section-help"]',
    title: "Help & Updates",
    content:
      "Settings > Help is your home base for support: restart this tutorial anytime, contact the developer, review every keyboard shortcut, and check for app updates.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="settings-section-help"]', {
        settingsSection: "help",
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
