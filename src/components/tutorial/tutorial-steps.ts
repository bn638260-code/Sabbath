import type { Step } from "react-joyride"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"
import { useBroadcastSettingsDialogStore } from "@/lib/broadcast-settings-dialog"
import { openSettings, type SettingsSection } from "@/lib/settings-dialog"
import {
  useDashboardWorkspaceStore,
  type DashboardWorkspace,
} from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useBroadcastLiveStore } from "@/stores/broadcast/live-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useLibraryStore } from "@/stores/library-store"
import type { TutorialMode } from "@/stores/tutorial-store"

export interface TutorialStep extends Step {
  completion?: {
    check?: () => boolean
    confirmationLabel?: string
    message: string
  }
}

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

export const TUTORIAL_STEPS: TutorialStep[] = [
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
    target: "body",
    title: "Practice: Present a verse",
    content:
      "Use Scripture & EGW to find a verse, preview it, then press Present. This step unlocks when the app has a live presentation item.",
    placement: "center",
    before: () => prepareTarget("body", { workspace: "live" }),
    completion: {
      check: () => Boolean(useBroadcastLiveStore.getState().liveItem),
      message: "Present a verse or other item before continuing.",
    },
  },
  {
    ...STEP_DEFAULTS,
    ...workspaceStep('[data-tour="service-schedules"]', "service-plans"),
    target: '[data-tour="service-schedules"]',
    title: "Service Schedules",
    content:
      "Create a service schedule from a template, add or reorder items, attach sermon slides or media, and save it before worship.",
    placement: "top",
    completion: {
      check: () => Boolean(useServicePlanStore.getState().activePlan),
      message: "Create or load a service schedule before continuing.",
    },
  },
  {
    ...STEP_DEFAULTS,
    ...workspaceStep('[data-tour="run-service"]', "run-service"),
    target: '[data-tour="run-service"]',
    title: "Run Service Flow",
    content:
      "Start Practice from your service schedule, then use this workspace to move through prepared items, sermon slides, hymns, preview, and live output.",
    placement: "top",
    completion: {
      check: () => {
        const mode = useServicePlanStore.getState().activePlan?.mode
        return mode === "practice" || mode === "performance"
      },
      message: "Open a schedule and start Practice or Live Service before continuing.",
    },
  },
  {
    ...STEP_DEFAULTS,
    ...workspaceStep('[data-tour="hymn-workspace"]', "hymns"),
    target: '[data-tour="hymn-workspace"]',
    title: "SDA Hymns and song slides",
    content:
      "Find an SDA hymn or build song slides from text. Generate a slide deck, preview it, then queue or present it for the service.",
    placement: "top",
    completion: {
      check: () => useHymnSlideStore.getState().deck.length > 0,
      message: "Generate a hymn or song slide deck before continuing.",
    },
  },
  {
    ...STEP_DEFAULTS,
    ...workspaceStep('[data-tour="library-workspace"]', "library"),
    target: '[data-tour="library-workspace"]',
    title: "Church Library",
    content:
      "Save reusable songs, images, themes, slide decks, and media here. Add one asset so it can be reused or attached to a service schedule.",
    placement: "top",
    completion: {
      check: () => useLibraryStore.getState().assets.length > 0,
      message: "Add or save one Church Library asset before continuing.",
    },
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
    completion: {
      confirmationLabel: "I opened Projector Setup and rehearsed the display steps.",
      message: "Confirm the projector rehearsal before continuing.",
    },
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="settings-section-account"]',
    title: "Pilot access",
    content:
      "Participants register, confirm their email, sign in, redeem the single-use invitation from the administrator, and acknowledge training. Access remains blocked while the pilot is draft, suspended, outside its dates, unpaid, or not onboarded.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="settings-section-account"]', {
        settingsSection: "account",
      }),
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
      "Deepgram, Soniox, and Speechmatics use your own third-party cloud accounts and are not free app features; paid rates and free allowances vary by provider. In Settings > Speech Recognition, choose a provider, use its Open console link to generate an API key, paste the key, press Save, then select Test key. Vosk is local and needs no API key.",
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
      "Settings > Display Mode switches between Auto and Manual broadcast. Auto sends the strongest confirmed detection straight to the live output; Manual waits for you to present. Semantic detection has its own switch and match-strength threshold.",
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
      "Settings > API Keys shows whether your Deepgram, Soniox, and Speechmatics keys are configured. Create, save, and test keys in Speech Recognition; no key is needed when using local Vosk.",
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
      "Settings > Account shows your signed-in email and approved computers. You can approve a pending second computer, deactivate a computer, sign out, or permanently delete your account. Pilot access is managed by the administrator.",
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
    title: "Operator readiness check",
    content:
      "Before serving live, confirm that you tested the microphone and speech provider, presented a verse, practised a service schedule, generated hymn slides, saved a reusable library asset, and rehearsed the projector.",
    placement: "center",
    before: () => prepareTarget("body", { workspace: "live" }),
    completion: {
      confirmationLabel: "I completed the operator readiness checklist.",
      message: "Confirm the readiness checklist before finishing training.",
    },
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

export const ADMIN_TUTORIAL_STEPS: TutorialStep[] = [
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="pilot-admin"]',
    title: "Pilot administration",
    content:
      "Only administrators see this panel. It controls agreement capacity, Schedule A churches, invitations, memberships, payment, onboarding, dates, and pilot status.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="pilot-admin"]', { settingsSection: "account" }),
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="pilot-limits"]',
    title: "Agreement capacity",
    content:
      "Set the maximum active churches, approved computers per church, and approved computers across the pilot. Limits cannot be reduced below current usage.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="pilot-limits"]', { settingsSection: "account" }),
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="pilot-churches"]',
    title: "Schedule A churches",
    content:
      "Add each agreement church before issuing codes. Mark a church replaced when it leaves the pilot; restoring it is allowed only within the active-church limit.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="pilot-churches"]', { settingsSection: "account" }),
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="pilot-invitations"]',
    title: "Single-use invitations",
    content:
      "Select an active church, role, and expiry, then generate a code. Copy it immediately because only its hash is stored. Revoke any unused code that should no longer work.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="pilot-invitations"]', { settingsSection: "account" }),
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="pilot-memberships"]',
    title: "Memberships and revocation",
    content:
      "Review which account belongs to each church and role. Revoking a membership also revokes that participant's active computers.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="pilot-memberships"]', { settingsSection: "account" }),
  },
  {
    ...STEP_DEFAULTS,
    target: '[data-tour="pilot-activation"]',
    title: "Activate only when ready",
    content:
      "Keep the pilot in Draft while preparing. Record commencement and expiry dates, first payment, and onboarding before selecting Active. Suspended and Expired block participant access.",
    placement: "left",
    before: () =>
      prepareTarget('[data-tour="pilot-activation"]', { settingsSection: "account" }),
    completion: {
      confirmationLabel: "I understand the activation and revocation controls.",
      message: "Confirm the administrator readiness check before finishing.",
    },
  },
]

export function tutorialStepsFor(mode: TutorialMode): TutorialStep[] {
  if (mode === "admin") return ADMIN_TUTORIAL_STEPS
  if (mode === "all") {
    return [
      ...TUTORIAL_STEPS.slice(0, -1),
      ...ADMIN_TUTORIAL_STEPS,
      TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1],
    ]
  }
  return TUTORIAL_STEPS
}

export function tutorialCompletionError(
  step: TutorialStep,
  confirmed: boolean
): string | null {
  const completion = step.completion
  if (completion?.confirmationLabel && !confirmed) return completion.message
  if (completion?.check && !completion.check()) return completion.message
  return null
}
