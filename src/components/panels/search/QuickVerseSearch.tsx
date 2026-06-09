import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
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
  return (
    <div className="relative flex-1">
      {quickSuggestion && quickSuggestion !== quickInput ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center px-3">
          <span className="text-xs font-normal">
            <span className="text-foreground">{quickInput}</span>
            <span className="text-gray-500 dark:text-gray-400">
              {quickSuggestion.slice(quickInput.length)}
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
        className={cn(
          "relative h-7 bg-black/40 text-xs",
          quickSuggestion && quickSuggestion !== quickInput ? "text-transparent" : "",
        )}
        style={
          quickSuggestion && quickSuggestion !== quickInput
            ? { caretColor: "var(--foreground)" }
            : undefined
        }
      />

      {shouldShowVerseDropdown && quickVersesList.length > 0 ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-white/5 bg-[rgba(2,3,7,0.95)] shadow-lg backdrop-blur-md">
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
                <span className="line-clamp-1 flex-1 text-muted-foreground">{verse.text}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
