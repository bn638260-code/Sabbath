import { useEffect, lazy, Suspense, useLayoutEffect, useRef } from "react"
import { AppControllerHeader } from "@/components/layout/app-controller-header"
import { OperatorStatusStrip } from "@/components/layout/operator-status-strip"
import { TranscriptPanel } from "@/components/panels/transcript-panel"
import { PreviewPanel } from "@/components/panels/preview-panel"
import { LiveOutputPanel } from "@/components/panels/live-output-panel"
import { QueuePanel } from "@/components/panels/queue-panel"
import { DetectionsPanel } from "@/components/panels/detections-panel"
import { LatestDetectionBar } from "@/components/panels/latest-detection-bar"
import { SearchPanel } from "@/components/panels/search-panel"
import { useDashboardKeyboardControls } from "@/hooks/use-dashboard-keyboard-controls"
import { cn } from "@/lib/utils"
import {
  ACCENT_THEME_STORAGE_KEY,
  accentThemeClassName,
  useAccentThemeStore,
} from "@/stores/accent-theme-store"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"

const LazyHymnWorkspace = lazy(() =>
  import("@/components/hymnal/HymnWorkspace").then((mod) => ({
    default: mod.HymnWorkspace,
  }))
)

const LazyServicePlanWorkspace = lazy(() =>
  import("@/components/service-plan/ServicePlanWorkspace").then((mod) => ({
    default: mod.ServicePlanWorkspace,
  }))
)

const LazyRunServicePage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.RunServicePage,
  }))
)

const LazyLiveServicePlanPage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.LiveServicePlanPage,
  }))
)

const LazySettingsPage = lazy(() =>
  import("@/components/settings/SettingsPage").then((mod) => ({
    default: mod.SettingsPage,
  }))
)

const LazyHelpLegalPage = lazy(() =>
  import("@/components/help/HelpLegalPage").then((mod) => ({
    default: mod.HelpLegalPage,
  }))
)

const LazyLibraryWorkspace = lazy(() =>
  import("@/components/library/LibraryWorkspace").then((mod) => ({
    default: mod.LibraryWorkspace,
  }))
)

const LazyQueueWorkspace = lazy(() =>
  import("@/components/queue/QueueWorkspace").then((mod) => ({
    default: mod.QueueWorkspace,
  }))
)

const LazyKineticThemesPage = lazy(() =>
  import("@/components/broadcast/KineticThemesPage").then((mod) => ({
    default: mod.KineticThemesPage,
  }))
)

function WorkspaceFallback() {
  return <div className="glass-panel min-h-[200px] animate-pulse" />
}

function LiveDeskPage() {
  return (
    <div className="view-pane grid grid-cols-12 gap-3">
      <TranscriptPanel className="glass-panel col-span-12 h-[720px] xl:col-span-3" />

      <div className="col-span-12 grid h-fit grid-cols-12 gap-3 xl:col-span-9">
        <PreviewPanel className="col-span-12 h-[440px] lg:col-span-5" />
        <LiveOutputPanel className="col-span-12 h-[440px] lg:col-span-7" />
        <LatestDetectionBar className="col-span-12 h-[260px]" />
        <QueuePanel className="col-span-12 h-[290px]" />
      </div>
    </div>
  )
}

function DetectionsPage() {
  return (
    <div className="view-pane grid grid-cols-12 gap-3">
      <DetectionsPanel className="col-span-12 min-h-[calc(100vh-136px)]" />
    </div>
  )
}

function ScriptureSearchPage() {
  return (
    <div className="view-pane flex min-h-[calc(100vh-136px)] flex-col">
      <SearchPanel />
    </div>
  )
}

export function Dashboard() {
  const workspace = useDashboardWorkspaceStore((s) => s.workspace)
  const setWorkspace = useDashboardWorkspaceStore((s) => s.setWorkspace)
  const plannerOpen = useServicePlanStore((s) => s.plannerOpen)
  const accentTheme = useAccentThemeStore((s) => s.theme)
  const hydrateAccent = useAccentThemeStore((s) => s.hydrate)
  const workspaceScrollRef = useRef<HTMLDivElement>(null)

  useDashboardKeyboardControls()

  useEffect(() => {
    hydrateAccent()
    const onStorage = (event: StorageEvent) => {
      if (event.key === ACCENT_THEME_STORAGE_KEY) {
        hydrateAccent()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [hydrateAccent])

  useEffect(() => {
    if (plannerOpen && workspace !== "service-plans") {
      setWorkspace("service-plans")
    }
  }, [plannerOpen, setWorkspace, workspace])

  useLayoutEffect(() => {
    const scrollContainer = workspaceScrollRef.current
    if (!scrollContainer) return

    const resetScroll = () => {
      scrollContainer.scrollTo({ top: 0, left: 0 })
    }

    resetScroll()
    const frame = window.requestAnimationFrame(resetScroll)
    const timer = window.setTimeout(resetScroll, 80)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [workspace])

  const workspaceContent =
    workspace === "live" ? (
      <LiveDeskPage />
    ) : workspace === "detections" ? (
      <DetectionsPage />
    ) : workspace === "scripture-search" ? (
      <ScriptureSearchPage />
    ) : workspace === "queue" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyQueueWorkspace />
      </Suspense>
    ) : workspace === "kinetic-themes" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyKineticThemesPage />
      </Suspense>
    ) : workspace === "service-plans" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyServicePlanWorkspace />
      </Suspense>
    ) : workspace === "hymns" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyHymnWorkspace />
      </Suspense>
    ) : workspace === "library" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyLibraryWorkspace />
      </Suspense>
    ) : workspace === "run-service" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyRunServicePage />
      </Suspense>
    ) : workspace === "live-service" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyLiveServicePlanPage />
      </Suspense>
    ) : workspace === "settings" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazySettingsPage />
      </Suspense>
    ) : workspace === "help-legal" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyHelpLegalPage />
      </Suspense>
    ) : null

  return (
    <div
      id="bodyThemeContainer"
      className={cn(
        accentThemeClassName(accentTheme),
        "fixed inset-0 overflow-hidden"
      )}
    >
      <div className="app-shell">
        <AppControllerHeader />

        <div className="flex flex-1 overflow-hidden">
          <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
            <OperatorStatusStrip />

            <div
              ref={workspaceScrollRef}
              data-slot="workspace-scroll"
              className="flex-1 scrollbar-thin overflow-y-auto p-4"
            >
              {workspaceContent}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
