import { lazy, Suspense, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PanelHeader } from "@/components/ui/panel-header"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { CastIcon, ClipboardListIcon, FileTextIcon, PaletteIcon } from "lucide-react"
import { LiveProductionGrid } from "./LiveProductionGrid"

const LazyBroadcastSettings = lazy(() =>
  import("@/components/broadcast/broadcast-settings").then((mod) => ({
    default: mod.BroadcastSettings,
  })),
)

const LazyThemeDesigner = lazy(() =>
  import("@/components/broadcast/theme-designer").then((mod) => ({
    default: mod.ThemeDesigner,
  })),
)

export function LiveServicePlanPage() {
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastSettingsMounted, setBroadcastSettingsMounted] = useState(false)
  const [themeDesignerMounted, setThemeDesignerMounted] = useState(false)
  const activePlan = useServicePlanStore((s) => s.activePlan)
  const serviceContext = useServicePlanStore((s) => s.serviceContext)
  const orderedItems = useMemo(
    () => [...(activePlan?.items ?? [])].sort((a, b) => a.order - b.order),
    [activePlan?.items],
  )

  return (
    <div className="view-pane flex min-h-full flex-col gap-5">
      <div className="glass-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Downstream broadcast
        </p>
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
              setThemeDesignerMounted(true)
              useBroadcastStore.getState().setDesignerOpen(true)
            }}
          >
            <PaletteIcon className="size-3.5" />
            Theme designer
          </Button>
        </div>
      </div>
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

      <LiveProductionGrid />

      <div className="grid min-h-[380px] grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="glass-panel relative flex min-h-[360px] flex-col overflow-hidden">
          <PanelHeader
            title="Live Service Plan"
            icon={<ClipboardListIcon className="size-4" />}
          >
            <Badge
              variant={serviceContext.performanceMode ? "default" : "outline"}
            >
              {serviceContext.planStatus}
            </Badge>
          </PanelHeader>
          <div className="grid gap-3 p-3 md:grid-cols-2">
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 shadow-inner shadow-black/20">
              <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
                Active item
              </div>
              <div className="mt-1 text-lg font-semibold">
                {serviceContext.activeItem?.title ?? "Nothing active"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground capitalize">
                {serviceContext.activeItem?.kind ??
                  "Start a service plan to populate this view"}
              </div>
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-4 shadow-inner shadow-black/20">
              <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
                Up next
              </div>
              <div className="mt-1 text-lg font-semibold">
                {serviceContext.nextItem?.title ?? "No next item"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground capitalize">
                {serviceContext.nextItem?.kind ?? "End of plan"}
              </div>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 px-3 pb-3">
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-white/10 bg-black/20">
              {orderedItems.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No service plan is loaded.
                </div>
              ) : (
                orderedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {item.title}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {item.kind}
                      </div>
                    </div>
                    <Badge
                      variant={item.status === "active" ? "default" : "outline"}
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
        <section className="glass-panel relative flex min-h-[360px] flex-col overflow-hidden">
          <PanelHeader
            title="Live Context"
            icon={<FileTextIcon className="size-4" />}
          />
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 text-sm">
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
            <div>
              <div className="text-[0.625rem] font-medium text-muted-foreground uppercase">
                Operator notes
              </div>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                {serviceContext.operatorNotes ||
                  "No notes for the active item."}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
