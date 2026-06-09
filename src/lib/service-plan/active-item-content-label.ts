import type { ServiceContextItem, ServiceItem } from "@/types/service-plan"

export function activeItemContentLabel(
  item: ServiceItem | ServiceContextItem | null | undefined,
): string {
  if (!item) return "No active item"
  if ("attachments" in item && item.attachments.some((a) => a.kind === "slide")) {
    return "Sermon slides"
  }
  if ("hymnRefs" in item && item.hymnRefs.length > 0) return "Hymn"
  if ("scriptureRefs" in item && item.scriptureRefs.length > 0) return "Scripture"
  if ("mediaRefs" in item && item.mediaRefs.length > 0) return "Media"
  return item.kind
}
