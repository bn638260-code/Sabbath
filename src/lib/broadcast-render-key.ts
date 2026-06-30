import type { BroadcastTheme, VerseRenderData, PresentationRenderData } from "@/types"

export function getBroadcastRenderKey(
  theme: BroadcastTheme,
  data: VerseRenderData | PresentationRenderData | null,
): string {
  return JSON.stringify({
    theme: {
      id: theme.id,
      updatedAt: theme.updatedAt,
      resolution: theme.resolution,
      background: theme.background,
      textBox: theme.textBox,
      verseText: theme.verseText,
      verseNumbers: theme.verseNumbers,
      reference: theme.reference,
      layout: theme.layout,
      // Kinetic metadata changes the rendered background, so it must affect the
      // key. The transient animation clock (timeMs) is intentionally excluded —
      // the kinetic render loop drives per-frame redraws separately, and folding
      // time in here would defeat the static-theme dedup cache.
      kinetic: theme.kinetic ?? null,
    },
    data,
  })
}
