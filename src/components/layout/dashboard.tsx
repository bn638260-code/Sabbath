import { useEffect, lazy, Suspense, useLayoutEffect, useRef } from "react"
import { AppControllerHeader } from "@/components/layout/app-controller-header"
import { OperatorStatusStrip } from "@/components/layout/operator-status-strip"
import { WorkspaceSidebar } from "@/components/layout/workspace-sidebar"
import { TranscriptPanel } from "@/components/panels/transcript-panel"
import { PreviewPanel } from "@/components/panels/preview-panel"
import { LiveOutputPanel } from "@/components/panels/live-output-panel"
import { QueuePanel } from "@/components/panels/queue-panel"
import { DetectionsPanel } from "@/components/panels/detections-panel"
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
  })),
)

const LazyServicePlanWorkspace = lazy(() =>
  import("@/components/service-plan/ServicePlanWorkspace").then((mod) => ({
    default: mod.ServicePlanWorkspace,
  })),
)

const LazyRunServicePage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.RunServicePage,
  })),
)

const LazyLiveServicePlanPage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.LiveServicePlanPage,
  })),
)

const LazyLiveHymnPage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.LiveHymnPage,
  })),
)

const LazySermonSlidesPage = lazy(() =>
  import("@/components/service-plan/ServicePlanPage").then((mod) => ({
    default: mod.SermonSlidesPage,
  })),
)

const LazySettingsPage = lazy(() =>
  import("@/components/settings/SettingsPage").then((mod) => ({
    default: mod.SettingsPage,
  })),
)

function WorkspaceFallback() {
  return <div className="glass-panel min-h-[200px] animate-pulse" />
}

function LiveDeskPage() {
  return (
    <div className="view-pane grid grid-cols-12 gap-5">
      <TranscriptPanel className="glass-panel col-span-12 h-[620px] xl:col-span-3" />

      <div className="col-span-12 grid h-fit grid-cols-12 gap-5 xl:col-span-9">
        <PreviewPanel className="col-span-12 h-[380px] lg:col-span-5" />
        <LiveOutputPanel className="col-span-12 h-[380px] lg:col-span-7" />
        <QueuePanel className="col-span-12 h-[250px] lg:col-span-6" />
        <DetectionsPanel className="col-span-12 h-[250px] lg:col-span-6" />
      </div>

      <div className="glass-panel col-span-12 p-5">
        <SearchPanel embedded />
      </div>
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
    ) : workspace === "service-plans" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyServicePlanWorkspace />
      </Suspense>
    ) : workspace === "hymns" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyHymnWorkspace />
      </Suspense>
    ) : workspace === "run-service" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyRunServicePage />
      </Suspense>
    ) : workspace === "live-service" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyLiveServicePlanPage />
      </Suspense>
    ) : workspace === "live-hymns" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazyLiveHymnPage />
      </Suspense>
    ) : workspace === "sermon-slides" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazySermonSlidesPage />
      </Suspense>
    ) : workspace === "settings" ? (
      <Suspense fallback={<WorkspaceFallback />}>
        <LazySettingsPage />
      </Suspense>
    ) : null

  return (
    <div
      id="bodyThemeContainer"
      className={cn(
        accentThemeClassName(accentTheme),
        "fixed inset-0 overflow-hidden",
      )}
    >
      <div className="app-shell">
        <AppControllerHeader />

        <div className="flex flex-1 overflow-hidden">
          <WorkspaceSidebar />

          <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
            <OperatorStatusStrip />

            <div
              ref={workspaceScrollRef}
              className="scrollbar-thin flex-1 overflow-y-auto p-5"
            >
              {workspaceContent}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
