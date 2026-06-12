import { useState, useEffect, useCallback, useMemo } from "react"
import { Joyride, STATUS, type EventData } from "react-joyride"
import { toast } from "sonner"
import { useSettingsStore } from "@/stores/settings-store"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import {
  useTutorialStore,
  hydrateOnboardingState,
  persistOnboardingComplete,
} from "@/stores/tutorial-store"
import { TUTORIAL_STEPS } from "./tutorial-steps"
import { TutorialTooltip } from "./tutorial-tooltip"
import { getTutorialArrowColor } from "./tutorial-arrow-color"

export function TutorialOverlay() {
  return <DesktopTutorialOverlay />
}

function DesktopTutorialOverlay() {
  const [isHydrated, setIsHydrated] = useState(false)
  const isRunning = useTutorialStore((s) => s.isRunning)
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete)
  const [arrowColor, setArrowColor] = useState<string | undefined>()

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
      TUTORIAL_STEPS.map((step) => ({
        ...step,
        arrowColor,
      })),
    [arrowColor]
  )

  useEffect(() => {
    hydrateOnboardingState().then(() => {
      setIsHydrated(true)
    })
  }, [])

  useEffect(() => {
    if (isHydrated && !onboardingComplete) {
      const timer = setTimeout(() => {
        useTutorialStore.getState().startTutorial()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isHydrated, onboardingComplete])

  const handleEvent = useCallback((data: EventData) => {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      useTutorialStore.getState().stopTutorial()
      useServicePlanStore.getState().closePlanner()
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
