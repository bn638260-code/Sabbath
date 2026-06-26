import type { ServiceAttachment, ServiceItem, SlideDeckPresentationItemData } from "@/types"
import { slideWithExtractedTextTheme } from "@/services/slides/slide-deck"

const IMAGE_KINDS = new Set<ServiceAttachment["kind"]>(["slide"])

export function getOrderedSermonSlideAttachments(
  item: ServiceItem | null,
): ServiceAttachment[] {
  if (!item) return []
  return item.attachments
    .filter((attachment) => IMAGE_KINDS.has(attachment.kind) && Boolean(attachment.thumbnailUrl))
    .sort((a, b) => (a.order ?? item.attachments.indexOf(a)) - (b.order ?? item.attachments.indexOf(b)))
}

export function buildSermonSlideDeck(
  item: ServiceItem | null,
): SlideDeckPresentationItemData[] {
  const slides = getOrderedSermonSlideAttachments(item)
  if (!item || slides.length === 0) return []

  return slides.map((slide, index) => {
    const label = slide.label.trim() || `Slide ${index + 1}`
    const deckSlide: SlideDeckPresentationItemData = {
      kind: "slideDeck",
      deckId: `sermon-slides-${item.id}`,
      deckTitle: item.title,
      slideId: slide.id,
      slideIndex: index,
      slideCount: slides.length,
      slidePath: slide.thumbnailUrl ?? slide.path ?? "",
      sectionId: slide.id,
      sectionLabel: label,
      reference: `${item.title} - ${label}`,
      segments: [{ text: label }],
      applyTheme: item.slidesApplyTheme || undefined,
      extractedTextLines: slide.extractedTextLines,
    }
    return item.slidesApplyTheme
      ? slideWithExtractedTextTheme(deckSlide)
      : deckSlide
  })
}
