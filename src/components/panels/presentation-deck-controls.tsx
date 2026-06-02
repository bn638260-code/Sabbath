import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  canNavigateDeck,
  clampDeckIndex,
  findDeckIndex,
  hymnDeckSlides,
  presentationDeckKind,
  presentationDeckSlideId,
  sermonDeckSlides,
  type PresentationDeckKind,
} from "@/lib/presentation-deck-navigation"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import type { PresentationRenderData } from "@/types"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

interface PresentationDeckControlsProps {
  item: PresentationRenderData | null
  onNavigate: (kind: PresentationDeckKind, index: number) => void
}

export function PresentationDeckControls({
  item,
  onNavigate,
}: PresentationDeckControlsProps) {
  const hymnDeck = useHymnSlideStore((s) => s.deck)
  const hymnActiveIndex = useHymnSlideStore((s) => s.activeIndex)
  const sermonDeck = useSermonSlideStore((s) => s.deck)
  const sermonActiveIndex = useSermonSlideStore((s) => s.activeIndex)
  const kind = presentationDeckKind(item)
  if (!kind) return null

  const deckSlides =
    kind === "hymn" ? hymnDeckSlides(hymnDeck) : sermonDeckSlides(sermonDeck)
  const fallbackIndex = kind === "hymn" ? hymnActiveIndex : sermonActiveIndex
  const currentIndex = findDeckIndex(
    deckSlides,
    presentationDeckSlideId(item),
    fallbackIndex,
  )
  const slide = deckSlides[currentIndex]
  const canNavigate = deckSlides.length > 0

  const navigate = (delta: number) => {
    const nextIndex = clampDeckIndex(deckSlides.length, currentIndex, delta)
    if (nextIndex === currentIndex) return
    onNavigate(kind, nextIndex)
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon-xs"
        variant="outline"
        disabled={!canNavigate || !canNavigateDeck(deckSlides.length, currentIndex, -1)}
        onClick={() => navigate(-1)}
        title={kind === "hymn" ? "Previous hymn slide" : "Previous sermon slide"}
      >
        <ChevronLeftIcon className="size-3" />
      </Button>
      <Badge
        variant="outline"
        className="min-w-12 justify-center tabular-nums"
        aria-label={`Slide ${(slide?.slideIndex ?? 0) + 1} of ${slide?.slideCount ?? 1}`}
      >
        {(slide?.slideIndex ?? 0) + 1} of {slide?.slideCount ?? 1}
      </Badge>
      <Button
        size="icon-xs"
        variant="outline"
        disabled={!canNavigate || !canNavigateDeck(deckSlides.length, currentIndex, 1)}
        onClick={() => navigate(1)}
        title={kind === "hymn" ? "Next hymn slide" : "Next sermon slide"}
      >
        <ChevronRightIcon className="size-3" />
      </Button>
    </div>
  )
}
