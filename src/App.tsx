import { lazy, Suspense, useEffect, useRef } from "react"
import { listen } from "@tauri-apps/api/event"
import { Dashboard } from "@/components/layout/dashboard"
import { useRemoteControl } from "@/hooks/use-remote-control"
import { useDetectionSettingsSync } from "@/hooks/use-detection-settings-sync"
import { Toaster, toast } from "sonner"
import { useVerificationStore } from "@/stores/verification-store"
import type { BroadcastOutputErrorEvent, BroadcastOutputIssueKind } from "@/types"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useApiKeyPromptStore } from "@/lib/api-key-prompt"
import { isTauriRuntime } from "@/lib/tauri-runtime"
import { useSettingsStore } from "@/stores/settings-store"
import { useTutorialStore } from "@/stores/tutorial-store"

const LazyTutorialOverlay = lazy(() =>
  import("@/components/tutorial/tutorial-overlay").then((mod) => ({
    default: mod.TutorialOverlay,
  })),
)

const LazyApiKeyPrompt = lazy(() =>
  import("@/components/ui/api-key-prompt").then((mod) => ({
    default: mod.ApiKeyPrompt,
  })),
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
  "persistence",
])

function isValidOutputErrorPayload(
  payload: unknown,
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
  useEffect(() => {
    if (!isTauriRuntime()) return

    let unlisten: (() => void) | undefined

    void listen<BroadcastOutputErrorEvent>("broadcast:output-error", (event) => {
      if (!isValidOutputErrorPayload(event.payload)) return
      useBroadcastStore.getState().reportOutputIssue({
        outputId: event.payload.outputId,
        kind: event.payload.kind,
        title: event.payload.title,
        description: event.payload.description,
      })
    })
      .then((dispose) => {
        unlisten = dispose
      })
      .catch(() => {
        // Non-Tauri or listener registration failure should not crash the app.
      })

    return () => {
      unlisten?.()
    }
  }, [])
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

export function App() {
  useRemoteControl()
  useDetectionSettingsSync()
  useBroadcastOutputErrorListener()
  useWelcomeToast()
  const apiKeyPromptOpen = useApiKeyPromptStore((s) => s.isOpen)
  const setApiKeyPromptOpen = useApiKeyPromptStore((s) => s.setOpen)
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete)
  const tutorialRunning = useTutorialStore((s) => s.isRunning)
  const shouldMountTutorial =
    isTauriRuntime() && (!onboardingComplete || tutorialRunning)

  return (
    <>
      <Dashboard />
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
        theme="dark"
        toastOptions={{
          classNames: {
            toast:
              "glass-panel border border-white/[0.08] bg-[linear-gradient(145deg,rgba(13,20,38,0.95),rgba(4,7,16,0.98))] text-foreground shadow-[0_24px_48px_rgba(0,0,0,0.6)]",
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
