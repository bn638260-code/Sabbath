import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  canNavigateDeck,
  clampDeckIndex,
  egwDeckSlides,
  findDeckIndex,
  hymnDeckSlides,
  presentationDeckKind,
  presentationDeckSlideId,
  sermonDeckSlides,
  type PresentationDeckKind,
} from "@/lib/presentation-deck-navigation"
import {
  getQueuedHymnDeckForRenderItem,
  restoreQueuedHymnDeckForRenderItem,
} from "@/lib/queued-hymn-deck"
import { useEgwSlideStore } from "@/stores/egw-slide-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import type { PresentationRenderData } from "@/types"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

interface PresentationDeckControlsProps {
  item: PresentationRenderData | null
  onNavigate: (kind: PresentationDeckKind, index: number) => void
}

const PREVIOUS_TITLES: Record<PresentationDeckKind, string> = {
  hymn: "Previous hymn slide",
  egw: "Previous EGW slide",
  slideDeck: "Previous sermon slide",
}

const NEXT_TITLES: Record<PresentationDeckKind, string> = {
  hymn: "Next hymn slide",
  egw: "Next EGW slide",
  slideDeck: "Next sermon slide",
}

export function PresentationDeckControls({
  item,
  onNavigate,
}: PresentationDeckControlsProps) {
  const hymnDeck = useHymnSlideStore((s) => s.deck)
  const hymnActiveIndex = useHymnSlideStore((s) => s.activeIndex)
  const sermonDeck = useSermonSlideStore((s) => s.deck)
  const sermonActiveIndex = useSermonSlideStore((s) => s.activeIndex)
  const egwDeck = useEgwSlideStore((s) => s.deck)
  const egwActiveIndex = useEgwSlideStore((s) => s.activeIndex)
  const kind = presentationDeckKind(item)
  if (!kind) return null

  const queuedHymnDeck =
    kind === "hymn" ? getQueuedHymnDeckForRenderItem(item) : null
  const deckSlidesByKind = {
    hymn: hymnDeckSlides(queuedHymnDeck ?? hymnDeck),
    egw: egwDeckSlides(egwDeck),
    slideDeck: sermonDeckSlides(sermonDeck),
  }
  const fallbackIndexByKind = {
    hymn: hymnActiveIndex,
    egw: egwActiveIndex,
    slideDeck: sermonActiveIndex,
  }
  const deckSlides = deckSlidesByKind[kind]
  const fallbackIndex = fallbackIndexByKind[kind]
  const currentIndex = findDeckIndex(
    deckSlides,
    presentationDeckSlideId(item),
    fallbackIndex
  )
  const slide = deckSlides[currentIndex]
  const canNavigate = deckSlides.length > 0

  const navigate = (delta: number) => {
    const nextIndex = clampDeckIndex(deckSlides.length, currentIndex, delta)
    if (nextIndex === currentIndex) return
    if (kind === "hymn") restoreQueuedHymnDeckForRenderItem(item)
    onNavigate(kind, nextIndex)
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon-xs"
        variant="outline"
        disabled={
          !canNavigate || !canNavigateDeck(deckSlides.length, currentIndex, -1)
        }
        onClick={() => navigate(-1)}
        title={PREVIOUS_TITLES[kind]}
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
        disabled={
          !canNavigate || !canNavigateDeck(deckSlides.length, currentIndex, 1)
        }
        onClick={() => navigate(1)}
        title={NEXT_TITLES[kind]}
      >
        <ChevronRightIcon className="size-3" />
      </Button>
    </div>
  )
}
