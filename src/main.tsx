import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { VerificationGate } from "@/components/verification/VerificationGate"
import { ErrorBoundary } from "@/components/error-boundary.tsx"
import { TooltipProvider } from "@/components/ui/tooltip.tsx"
import { hydrateSettings } from "@/stores/settings-store"
import { hydrateVerification } from "@/stores/verification-store"
import { hydrateBibleStore, initBiblePersistence } from "@/stores/bible-store"
import { hydrateBroadcastThemes } from "@/stores/broadcast/persistence"
import { hydrateServicePlans } from "@/stores/service-plan-store"
import { hydrateLibraryStore } from "@/stores/library-store"
import { useAccentThemeStore } from "@/stores/accent-theme-store"
import { useColorModeStore } from "@/stores/color-mode-store"
import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"
import { installOperatorFlowHarness } from "@/test/operator-flow-harness"

// Dev-only screenshot/demo mode. `import.meta.env.DEV` is statically false in
// production, so this constant folds to `false` and the dynamic import of the
// seed module below is tree-shaken out of the prod bundle entirely.
const demoMode =
  import.meta.env.DEV &&
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("demo")

function hydrateControllerColorMode() {
  useColorModeStore.getState().hydrate()
}

hydrateControllerColorMode()

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
// Verification needs the network (Supabase session refresh), so it hydrates
// independently: the gate shows its checking state instead of blocking first
// paint behind a slow or unreachable connection.
// In dev demo mode the seed forces a verified state, so skip the network
// verification that would otherwise overwrite it.
if (!demoMode) {
  void hydrateVerification()
}

const resetTranscription = isTauriRuntime()
  ? invokeTauri("stop_transcription").catch((error) => {
      console.warn("[startup] stop_transcription reset failed", error)
    })
  : Promise.resolve()

resetTranscription
  .catch((error) => {
    console.warn("[startup] reset transcription promise failed", error)
  })
  .then(() =>
    Promise.all([
      hydrateSettings(),
      hydrateBibleStore(),
      hydrateBroadcastThemes(),
      hydrateServicePlans(),
      hydrateLibraryStore(),
    ]).then(() => {
      useAccentThemeStore.getState().hydrate()
      useColorModeStore.getState().hydrate()
    })
  )
  .then(() => initBiblePersistence())
  .finally(async () => {
    // Dev-only: populate stores for screenshots when `?demo` is present. The
    // dynamic import keeps the seed module out of production builds.
    if (demoMode) {
      const { maybeSeedDemoState } = await import("@/lib/dev/demo-seed")
      maybeSeedDemoState()
    }
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <TooltipProvider>
          <ErrorBoundary>
            <VerificationGate>
              <App />
            </VerificationGate>
          </ErrorBoundary>
        </TooltipProvider>
      </StrictMode>
    )
  })
