import { Input } from "@/components/ui/input"
import { getGhostSuggestionSuffix } from "@/lib/quick-search"
import type { Verse } from "@/types"

export function QuickVerseSearch({
  quickInput,
  quickSuggestion,
  quickVersesList,
  shouldShowVerseDropdown,
  quickInputRef,
  onQuickInputChange,
  onQuickKeyDown,
  onQuickVerseClick,
}: {
  quickInput: string
  quickSuggestion: string
  quickVersesList: Verse[]
  shouldShowVerseDropdown: boolean
  quickInputRef: React.RefObject<HTMLInputElement | null>
  onQuickInputChange: (value: string) => void
  onQuickKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  onQuickVerseClick: (verse: Verse) => void
}) {
  // Hide the grey autocomplete hint once the verse results dropdown is open,
  // so it doesn't linger over the input while matching content is shown.
  const ghostSuggestionSuffix = shouldShowVerseDropdown
    ? null
    : getGhostSuggestionSuffix(quickInput, quickSuggestion)

  return (
    <div className="relative flex-1">
      {/* The real input renders the typed text; the overlay reuses it as an
          invisible spacer so only the grey suggestion suffix is drawn after it. */}
      {ghostSuggestionSuffix ? (
        <div
          data-testid="quick-search-ghost"
          className="pointer-events-none absolute inset-0 z-10 flex items-center px-3"
        >
          <span className="text-xs font-normal">
            <span className="invisible">{quickInput}</span>
            <span className="text-gray-500 dark:text-gray-400">
              {ghostSuggestionSuffix}
            </span>
          </span>
        </div>
      ) : null}

      <Input
        ref={quickInputRef}
        data-tour="quick-nav"
        value={quickInput}
        onChange={(e) => onQuickInputChange(e.target.value)}
        onKeyDown={onQuickKeyDown}
        placeholder="Type: J → John 3:16"
        className="relative h-7 bg-[var(--shell-code-bg)] text-xs"
      />

      {shouldShowVerseDropdown && quickVersesList.length > 0 ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--shell-bg-elevated)] text-foreground shadow-lg backdrop-blur-md">
          <div className="p-1">
            {quickVersesList.map((verse) => (
              <button
                key={verse.id}
                onClick={() => onQuickVerseClick(verse)}
                className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
              >
                <span className="w-6 shrink-0 text-right font-semibold text-primary">
                  {verse.verse}
                </span>
                <span className="line-clamp-1 flex-1 text-muted-foreground">
                  {verse.text}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
