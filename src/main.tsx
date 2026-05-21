import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip.tsx"
import { hydrateSettings } from "@/stores/settings-store"
import { hydrateBibleStore, initBiblePersistence } from "@/stores/bible-store"
import { hydrateBroadcastThemes } from "@/stores/broadcast-store"
import { hydrateServicePlans } from "@/stores/service-plan-store"
import { hydrateVerification } from "@/stores/verification-store"
import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"

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
      hydrateVerification(),
    ]),
  )
  .then(() => initBiblePersistence())
  .finally(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>
            <App />
          </TooltipProvider>
        </ThemeProvider>
      </StrictMode>
    )
  })
