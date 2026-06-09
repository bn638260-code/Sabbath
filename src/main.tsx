import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ErrorBoundary } from "@/components/error-boundary.tsx"
import { TooltipProvider } from "@/components/ui/tooltip.tsx"
import { hydrateSettings } from "@/stores/settings-store"
import { hydrateBibleStore, initBiblePersistence } from "@/stores/bible-store"
import { hydrateBroadcastThemes } from "@/stores/broadcast-store"
import { hydrateServicePlans } from "@/stores/service-plan-store"
import { useAccentThemeStore } from "@/stores/accent-theme-store"
import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"
import { installOperatorFlowHarness } from "@/test/operator-flow-harness"

function ensureControllerDarkShell() {
  const root = document.documentElement
  root.classList.remove("light")
  root.classList.add("dark")
}

ensureControllerDarkShell()

if (
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("e2e")
) {
  installOperatorFlowHarness()
}

// Webview reloads do NOT restart the Rust backend, so any STT pipeline
// left running from the previous webview session still has
// `stt_active = true`. That makes the next `start_transcription` call
// fail silently with "Transcription is already running". Reset the
// backend to a clean state on boot, then hydrate persisted settings and
// bible store so the UI reflects the user's choices immediately.
const resetTranscription = isTauriRuntime()
  ? invokeTauri("stop_transcription").catch(() => {})
  : Promise.resolve()

resetTranscription
  .catch(() => {})
  .then(() =>
    Promise.all([
      hydrateSettings(),
      hydrateBibleStore(),
      hydrateBroadcastThemes(),
      hydrateServicePlans(),
    ]).then(() => {
      useAccentThemeStore.getState().hydrate()
    }),
  )
  .then(() => initBiblePersistence())
  .finally(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <TooltipProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </TooltipProvider>
      </StrictMode>
    )
  })
