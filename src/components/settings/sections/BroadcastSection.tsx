import { lazy, Suspense, useState } from "react"
import { Button } from "@/components/ui/button"
import { CastIcon } from "lucide-react"

const LazyBroadcastSettings = lazy(() =>
  import("@/components/broadcast/broadcast-settings").then((mod) => ({
    default: mod.BroadcastSettings,
  })),
)

export function BroadcastSection() {
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastSettingsMounted, setBroadcastSettingsMounted] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Broadcast outputs
            </p>
            <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
              Manage HDMI projector targets, fullscreen output, and the active
              themes used on your audience displays. NDI is coming soon.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setBroadcastSettingsMounted(true)
              setBroadcastOpen(true)
            }}
          >
            <CastIcon className="size-3.5" />
            Open broadcast settings
          </Button>
        </div>
      </div>

      {broadcastSettingsMounted ? (
        <Suspense fallback={null}>
          <LazyBroadcastSettings
            open={broadcastOpen}
            onOpenChange={setBroadcastOpen}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
