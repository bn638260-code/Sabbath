import { lazy, Suspense, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PanelHeader } from "@/components/ui/panel-header"
import { LiveOutputPanel } from "@/components/panels/live-output-panel"
import { PreviewPanel } from "@/components/panels/preview-panel"
import { useBroadcastDesignerStore } from "@/stores/broadcast/designer-store"
import { useBroadcastLiveStore } from "@/stores/broadcast/live-store"
import {
  selectLatestOutputIssue,
  useBroadcastOutputIssueStore,
} from "@/stores/broadcast/output-issue-store"
import {
  selectActiveTheme,
  useBroadcastThemeStore,
} from "@/stores/broadcast/theme-store"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import {
  AlertTriangleIcon,
  CastIcon,
  FileTextIcon,
  MonitorIcon,
  PaletteIcon,
  RadioIcon,
  SparklesIcon,
} from "lucide-react"

const LazyBroadcastSettings = lazy(() =>
  import("@/components/broadcast/broadcast-settings").then((mod) => ({
    default: mod.BroadcastSettings,
  }))
)

const LazyThemeDesigner = lazy(() =>
  import("@/components/broadcast/theme-designer").then((mod) => ({
    default: mod.ThemeDesigner,
  }))
)

function OutputStatusPanel({
  isLive,
  activeThemeName,
  previewReference,
  liveReference,
  latestOutputIssue,
}: {
  isLive: boolean
  activeThemeName: string | null
  previewReference: string | null
  liveReference: string | null
  latestOutputIssue: ReturnType<typeof selectLatestOutputIssue>
}) {
  return (
    <section className="glass-panel relative flex flex-col overflow-hidden">
      <PanelHeader
        title="Output Status"
        icon={<RadioIcon className="size-4" />}
      >
        <Badge variant={isLive ? "default" : "outline"}>
          {isLive ? "On air" : "Hidden"}
        </Badge>
      </PanelHeader>
      <div className="space-y-3 p-3">
        <div className="rounded-md border border-[var(--border-dim)] bg-[var(--shell-bg-sunken)] p-3">
          <div className="flex items-center gap-2 text-[0.625rem] font-medium text-muted-foreground uppercase">
            <MonitorIcon className="size-3.5" />
            Active theme
          </div>
          <p className="mt-1 truncate text-sm font-medium">
            {activeThemeName ?? "No theme selected"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-[var(--border-dim)] bg-[var(--shell-bg-sunken)] p-3">
            <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
              Preview
            </div>
            <p className="mt-1 truncate text-sm font-medium">
              {previewReference ?? "Empty"}
            </p>
          </div>
          <div className="rounded-md border border-[var(--border-dim)] bg-[var(--shell-bg-sunken)] p-3">
            <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
              Live
            </div>
            <p className="mt-1 truncate text-sm font-medium">
              {liveReference ?? "Nothing live"}
            </p>
          </div>
        </div>
        {latestOutputIssue ? (
          <div className="rounded-md border border-amber-500/25 bg-amber-500/10 p-3">
            <div className="flex items-center gap-2 text-[0.625rem] font-medium text-amber-100/90 uppercase">
              <AlertTriangleIcon className="size-3.5" />
              {latestOutputIssue.title}
            </div>
            <p className="mt-1 line-clamp-3 text-xs text-amber-100/75">
              {latestOutputIssue.description}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  )
}

function ServiceSignalPanel({
  serviceContext,
}: {
  serviceContext: ReturnType<
    typeof useServicePlanStore.getState
  >["serviceContext"]
}) {
  return (
    <section className="glass-panel relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <PanelHeader
        title="Service Signal"
        icon={<FileTextIcon className="size-4" />}
      >
        <Badge variant={serviceContext.performanceMode ? "default" : "outline"}>
          {serviceContext.planStatus}
        </Badge>
      </PanelHeader>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div className="rounded-md border border-[var(--border-dim)] bg-[var(--shell-bg-sunken)] p-3">
          <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
            Active item
          </div>
          <p className="mt-1 truncate text-sm font-medium">
            {serviceContext.activeItem?.title ?? "Nothing active"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground capitalize">
            {serviceContext.activeItem?.kind ??
              "Start a service plan to populate this view"}
          </p>
        </div>

        <div className="rounded-md border border-[var(--border-dim)] bg-[var(--shell-bg-sunken)] p-3">
          <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
            Up next
          </div>
          <p className="mt-1 truncate text-sm font-medium">
            {serviceContext.nextItem?.title ?? "No next item"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground capitalize">
            {serviceContext.nextItem?.kind ?? "End of plan"}
          </p>
        </div>

        <div>
          <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
            Expected references
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {serviceContext.expectedReferences.length > 0 ? (
              serviceContext.expectedReferences.map((ref) => (
                <Badge key={ref} variant="secondary">
                  {ref}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">
                None for the active item.
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

export function LiveServicePlanPage() {
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastSettingsMounted, setBroadcastSettingsMounted] =
    useState(false)
  const [themeDesignerMounted, setThemeDesignerMounted] = useState(false)
  const serviceContext = useServicePlanStore((s) => s.serviceContext)
  const isLive = useBroadcastLiveStore((s) => s.isLive)
  const liveItem = useBroadcastLiveStore((s) => s.liveItem)
  const previewItem = useBroadcastLiveStore((s) => s.previewItem)
  const activeTheme = useBroadcastThemeStore(selectActiveTheme)
  const latestOutputIssue = useBroadcastOutputIssueStore(
    selectLatestOutputIssue
  )

  return (
    <div className="view-pane flex min-h-full flex-col gap-5">
      <section className="glass-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Broadcast control
          </p>
          <h1 className="mt-1 text-xl font-semibold text-foreground">
            Production Output
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="chrome"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setBroadcastSettingsMounted(true)
              setBroadcastOpen(true)
            }}
          >
            <CastIcon className="size-3.5" />
            Broadcast settings
          </Button>
          <Button
            variant="chrome"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              useServicePlanStore.getState().closePlanner()
              useDashboardWorkspaceStore
                .getState()
                .setWorkspace("kinetic-themes")
            }}
          >
            <SparklesIcon className="size-3.5" />
            Kinetic themes
          </Button>
          <Button
            variant="chrome"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setThemeDesignerMounted(true)
              useBroadcastDesignerStore.getState().setDesignerOpen(true)
            }}
          >
            <PaletteIcon className="size-3.5" />
            Theme designer
          </Button>
        </div>
      </section>

      {broadcastSettingsMounted && (
        <Suspense fallback={null}>
          <LazyBroadcastSettings
            open={broadcastOpen}
            onOpenChange={setBroadcastOpen}
          />
        </Suspense>
      )}
      {themeDesignerMounted && (
        <Suspense fallback={null}>
          <LazyThemeDesigner />
        </Suspense>
      )}

      <div className="grid min-h-[620px] grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="grid min-h-[560px] grid-cols-1 gap-5 lg:grid-cols-2">
          <PreviewPanel />
          <LiveOutputPanel />
        </section>

        <aside className="flex min-h-[560px] flex-col gap-5">
          <OutputStatusPanel
            isLive={isLive}
            activeThemeName={activeTheme?.name ?? null}
            previewReference={previewItem?.reference ?? null}
            liveReference={liveItem?.reference ?? null}
            latestOutputIssue={latestOutputIssue}
          />
          <ServiceSignalPanel serviceContext={serviceContext} />
        </aside>
      </div>
    </div>
  )
}
