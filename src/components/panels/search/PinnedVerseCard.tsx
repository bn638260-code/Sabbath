import { XIcon } from "lucide-react"
import type { Verse } from "@/types"

/** Highlighted card pinning the last quick-search verse above the chapter list. */
export function PinnedVerseCard({
  verse,
  translationLabel,
  onSelect,
  onDismiss,
}: {
  verse: Verse
  translationLabel: string
  onSelect: (verse: Verse) => void
  onDismiss: () => void
}) {
  return (
    <div
      data-slot="pinned-verse"
      className="flex shrink-0 items-start gap-2 border-b border-lime-500/40 bg-lime-500/10 px-3 py-2"
    >
      <button
        onClick={() => onSelect(verse)}
        className="flex-1 text-left"
        title="Preview this verse"
      >
        <span className="text-xs font-semibold text-lime-700 dark:text-lime-400">
          {verse.book_name} {verse.chapter}:{verse.verse}
          <span className="ml-1.5 font-normal text-muted-foreground">{translationLabel}</span>
        </span>
        <p className="mt-0.5 line-clamp-2 text-xs text-foreground">{verse.text}</p>
      </button>
      <button
        onClick={onDismiss}
        className="rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss pinned verse"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  )
}
