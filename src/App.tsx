import { Dashboard } from "@/components/layout/dashboard"
import { useRemoteControl } from "@/hooks/use-remote-control"
import { useDetectionSettingsSync } from "@/hooks/use-detection-settings-sync"
import { TutorialOverlay } from "@/components/tutorial/tutorial-overlay"
import { VerificationGate } from "@/components/verification/VerificationGate"
import { Toaster } from "sonner"

export function App() {
  useRemoteControl()
  useDetectionSettingsSync()
  return (
    <>
      <VerificationGate>
        <Dashboard />
        <TutorialOverlay />
      </VerificationGate>
      <Toaster position="bottom-right" />
    </>
  )
}

export default App
