import { Button } from "@/components/ui/button"
import { advancePresentationTarget } from "@/lib/presentation-panel-navigation"
import type { PresentationRenderData } from "@/types"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

// Always-visible previous/next arrows for content without a slide deck (e.g. a
// single scripture verse). Mirrors the focused ArrowLeft/ArrowRight behavior so
// operators can navigate by click as well as by key.
export function PresentationArrowControls({
  item,
  isLive,
}: {
  item: PresentationRenderData | null
  isLive: boolean
}) {
  if (!item) return null

  const advance = (delta: number) => {
    advancePresentationTarget(delta, item, isLive)
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon-xs"
        variant="outline"
        onClick={() => advance(-1)}
        title="Previous (←)"
        aria-label="Previous"
      >
        <ChevronLeftIcon className="size-3" />
      </Button>
      <Button
        size="icon-xs"
        variant="outline"
        onClick={() => advance(1)}
        title="Next (→)"
        aria-label="Next"
      >
        <ChevronRightIcon className="size-3" />
      </Button>
    </div>
  )
}
