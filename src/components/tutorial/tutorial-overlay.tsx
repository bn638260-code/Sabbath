import { useState, useEffect, useCallback, useMemo } from "react"
import { Joyride, STATUS, type EventData } from "react-joyride"
import { toast } from "sonner"
import { useBroadcastSettingsDialogStore } from "@/lib/broadcast-settings-dialog"
import { useSettingsStore } from "@/stores/settings-store"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { fetchIsAdmin } from "@/lib/supabase/account"
import {
  useTutorialStore,
  hydrateOnboardingState,
  persistOnboardingComplete,
} from "@/stores/tutorial-store"
import { tutorialStepsFor } from "./tutorial-steps"
import { TutorialTooltip } from "./tutorial-tooltip"
import { getTutorialArrowColor } from "./tutorial-arrow-color"

export function TutorialOverlay() {
  return <DesktopTutorialOverlay />
}

function DesktopTutorialOverlay() {
  const [isHydrated, setIsHydrated] = useState(false)
  const isRunning = useTutorialStore((s) => s.isRunning)
  const mode = useTutorialStore((s) => s.mode)
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete)
  const [arrowColor, setArrowColor] = useState<string | undefined>()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const cardEl = document.querySelector(".glass-panel")
      if (cardEl) {
        setArrowColor(getTutorialArrowColor(getComputedStyle(cardEl)))
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const steps = useMemo(
    () =>
      tutorialStepsFor(mode).map((step) => ({
        ...step,
        arrowColor,
      })),
    [arrowColor, mode]
  )

  useEffect(() => {
    let cancelled = false
    void Promise.all([hydrateOnboardingState(), fetchIsAdmin()]).then(([, admin]) => {
      if (cancelled) return
      setIsAdmin(admin)
      setIsHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (isHydrated && !onboardingComplete) {
      const timer = setTimeout(() => {
        useTutorialStore.getState().startTutorial(isAdmin ? "all" : "operator")
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isAdmin, isHydrated, onboardingComplete])

  const handleEvent = useCallback((data: EventData) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      useTutorialStore.getState().stopTutorial()
      useServicePlanStore.getState().closePlanner()
      useBroadcastSettingsDialogStore.getState().setOpen(false)
      useDashboardWorkspaceStore.getState().setWorkspace("live")
      persistOnboardingComplete()

      if (data.status === STATUS.SKIPPED) {
        toast.info("Tutorial skipped", {
          description: "Restart anytime in Settings.",
        })
      }
    }
  }, [])

  if (!isHydrated) return null

  return (
    <Joyride
      steps={steps}
      run={isRunning}
      continuous
      tooltipComponent={TutorialTooltip}
      onEvent={handleEvent}
      options={{
        buttons: ["back", "primary", "skip"],
        skipScroll: true,
        targetWaitTimeout: 2500,
        zIndex: 60,
        overlayColor: "rgba(0, 0, 0, 0.5)",
      }}
    />
  )
}
