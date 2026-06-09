import { lazy, Suspense, useState } from "react"
import { Button } from "@/components/ui/button"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { PaletteIcon } from "lucide-react"

const LazyThemeDesigner = lazy(() =>
  import("@/components/broadcast/theme-designer").then((mod) => ({
    default: mod.ThemeDesigner,
  })),
)

export function ThemeSection() {
  const [themeDesignerMounted, setThemeDesignerMounted] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-white/5 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Theme designer
            </p>
            <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
              Adjust lyric layouts, lower thirds, fonts, backgrounds, and text
              positioning in the full-screen theme workspace.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setThemeDesignerMounted(true)
              useBroadcastStore.getState().setDesignerOpen(true)
            }}
          >
            <PaletteIcon className="size-3.5" />
            Open theme designer
          </Button>
        </div>
      </div>

      {themeDesignerMounted ? (
        <Suspense fallback={null}>
          <LazyThemeDesigner />
        </Suspense>
      ) : null}
    </div>
  )
}
