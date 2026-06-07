import { lazy, Suspense } from "react"
import { Dashboard } from "@/components/layout/dashboard"
import { useRemoteControl } from "@/hooks/use-remote-control"
import { useDetectionSettingsSync } from "@/hooks/use-detection-settings-sync"
import { Toaster } from "sonner"
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

export function App() {
  useRemoteControl()
  useDetectionSettingsSync()
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
