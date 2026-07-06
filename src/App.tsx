import { lazy, Suspense, useEffect, useRef } from "react"
import { Dashboard } from "@/components/layout/dashboard"
import { ProjectorSetupPanel } from "@/components/broadcast/ProjectorSetupPanel"
import { useMonitorWatcher } from "@/hooks/use-monitor-watcher"
import { useRemoteControl } from "@/hooks/use-remote-control"
import { useTranscriptionEventBridge } from "@/hooks/use-transcription"
import { useDetectionSettingsSync } from "@/hooks/use-detection-settings-sync"
import { useAnnouncements } from "@/hooks/use-announcements"
import { useAppUpdate } from "@/hooks/use-app-update"
import { useTauriEvent } from "@/hooks/use-tauri-event"
import { Toaster, toast } from "sonner"
import { useVerificationStore } from "@/stores/verification-store"
import type {
  BroadcastOutputErrorEvent,
  BroadcastOutputIssueKind,
} from "@/types"
import { useBroadcastOutputIssueStore } from "@/stores/broadcast/output-issue-store"
import { useApiKeyPromptStore } from "@/lib/api-key-prompt"
import { isTauriRuntime } from "@/lib/tauri-runtime"
import { useSettingsStore } from "@/stores/settings-store"
import { useTutorialStore } from "@/stores/tutorial-store"
import { useColorModeStore } from "@/stores/color-mode-store"

const LazyTutorialOverlay = lazy(() =>
  import("@/components/tutorial/tutorial-overlay").then((mod) => ({
    default: mod.TutorialOverlay,
  }))
)

const LazyApiKeyPrompt = lazy(() =>
  import("@/components/ui/api-key-prompt").then((mod) => ({
    default: mod.ApiKeyPrompt,
  }))
)

const VALID_OUTPUT_ERROR_KINDS = new Set<BroadcastOutputIssueKind>([
  "broadcast-sync",
  "preview-open",
  "ndi-config",
  "ndi-frame",
  "detection-settings",
  "manual-detection",
  "auto-detection",
  "verse-lookup",
  "video-audio",
  "persistence",
])

function isValidOutputErrorPayload(
  payload: unknown
): payload is BroadcastOutputErrorEvent {
  if (!payload || typeof payload !== "object") return false
  const event = payload as BroadcastOutputErrorEvent
  return (
    (event.outputId === "main" || event.outputId === "alt") &&
    VALID_OUTPUT_ERROR_KINDS.has(event.kind) &&
    typeof event.title === "string" &&
    typeof event.description === "string"
  )
}

function useBroadcastOutputErrorListener() {
  useTauriEvent<BroadcastOutputErrorEvent>(
    "broadcast:output-error",
    (payload) => {
      if (!isValidOutputErrorPayload(payload)) return
      useBroadcastOutputIssueStore.getState().reportOutputIssue({
        outputId: payload.outputId,
        kind: payload.kind,
        title: payload.title,
        description: payload.description,
      })
    }
  )
}

function useWelcomeToast() {
  const status = useVerificationStore((s) => s.status)
  const email = useVerificationStore((s) => s.verifiedEmail)
  const welcomedRef = useRef(false)

  useEffect(() => {
    if (status !== "verified" || welcomedRef.current) return
    welcomedRef.current = true
    toast.success(email ? `Welcome back, ${email}` : "Welcome to SabbathCue", {
      description: "You are signed in and ready to go.",
    })
  }, [status, email])
}

function useAppUpdateLauncher() {
  const status = useVerificationStore((s) => s.status)
  const { state, loadVersion, install, autoCheckOnce } = useAppUpdate()
  const updateToastIdRef = useRef<string | number | null>(null)
  const autoCheckedRef = useRef(false)

  useEffect(() => {
    if (!isTauriRuntime()) return
    void loadVersion()
  }, [loadVersion])

  useEffect(() => {
    if (status !== "verified" || autoCheckedRef.current || !isTauriRuntime())
      return
    autoCheckedRef.current = true

    void autoCheckOnce().then((result) => {
      if (!result?.available || !result.update) return

      updateToastIdRef.current = toast(
        `Update ${result.update.version} available`,
        {
          description: "A new version is ready to install.",
          duration: Infinity,
          action: {
            label: "Install & restart",
            onClick: () => {
              void install()
            },
          },
        }
      )
    })
  }, [status, autoCheckOnce, install])

  useEffect(() => {
    if (state.phase !== "downloading" || updateToastIdRef.current === null)
      return

    const label =
      state.downloadPercent !== null
        ? `Downloading update… ${state.downloadPercent}%`
        : "Downloading update…"

    toast.loading(label, { id: updateToastIdRef.current })
  }, [state.phase, state.downloadPercent])

  useEffect(() => {
    if (state.phase === "installed" && updateToastIdRef.current !== null) {
      toast.success("Update installed. Restarting…", {
        id: updateToastIdRef.current,
      })
      updateToastIdRef.current = null
    }
  }, [state.phase])
}

export function App() {
  useRemoteControl()
  useTranscriptionEventBridge()
  useDetectionSettingsSync()
  useBroadcastOutputErrorListener()
  useWelcomeToast()
  useAnnouncements()
  useAppUpdateLauncher()
  useMonitorWatcher()
  const apiKeyPromptOpen = useApiKeyPromptStore((s) => s.isOpen)
  const setApiKeyPromptOpen = useApiKeyPromptStore((s) => s.setOpen)
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete)
  const tutorialRunning = useTutorialStore((s) => s.isRunning)
  const colorMode = useColorModeStore((s) => s.mode)
  const shouldMountTutorial = !onboardingComplete || tutorialRunning

  return (
    <>
      <Dashboard />
      <ProjectorSetupPanel />
      {shouldMountTutorial ? (
        <Suspense fallback={null}>
          <LazyTutorialOverlay />
        </Suspense>
      ) : null}
      {apiKeyPromptOpen ? (
        <Suspense fallback={null}>
          <LazyApiKeyPrompt
            open={apiKeyPromptOpen}
            onOpenChange={setApiKeyPromptOpen}
            service="Deepgram"
            description="Live transcription needs a Deepgram API key. Add it in settings so the app can start listening."
          />
        </Suspense>
      ) : null}
      <Toaster
        position="bottom-right"
        theme={colorMode}
        toastOptions={{
          classNames: {
            toast:
              "glass-panel border border-[var(--border-subtle)] bg-[linear-gradient(145deg,var(--bg-surface),var(--bg-elevated))] text-foreground shadow-[var(--shell-panel-shadow)]",
            title: "text-foreground",
            description: "text-muted-foreground",
            actionButton: "btn-action",
            cancelButton: "btn-action",
          },
        }}
      />
    </>
  )
}

export default App
