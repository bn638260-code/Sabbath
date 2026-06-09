import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { createScriptureQueueItem } from "@/lib/presentation-workflow"
import { useQueueStore } from "@/stores/queue-store"
import type { Book, Verse } from "@/types"
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, PlusIcon } from "lucide-react"

export function BookChapterBrowser({
  selectedBook,
  chapter,
  maxChapter,
  currentChapter,
  effectiveSelectedVerseId,
  queuedVerseKeys,
  onChapterChange,
  onSelectVerse,
}: {
  selectedBook: Book | null
  chapter: number
  maxChapter: number
  currentChapter: Verse[]
  effectiveSelectedVerseId: number | null
  queuedVerseKeys: Set<string>
  onChapterChange: (chapter: number) => void
  onSelectVerse: (verse: Verse) => void
}) {
  return (
    <>
      <div className="flex min-h-9 shrink-0 items-center justify-between border-b border-white/5 px-3 py-2">
        {selectedBook ? (
          <h3 className="text-sm font-semibold text-foreground">
            {selectedBook.name} {chapter}
          </h3>
        ) : null}
        {selectedBook ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onChapterChange(chapter > 1 ? chapter - 1 : chapter)}
              disabled={chapter <= 1}
            >
              <ArrowLeftIcon className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onChapterChange(chapter < maxChapter ? chapter + 1 : chapter)}
              disabled={chapter >= maxChapter}
            >
              <ArrowRightIcon className="size-3" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-0 p-2">
          {currentChapter.map((verse) => (
            <div
              key={verse.id}
              id={`verse-${verse.id}`}
              onClick={() => onSelectVerse(verse)}
              className={cn(
                "group flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors",
                verse.id === effectiveSelectedVerseId
                  ? "border border-lime-500/50 bg-lime-500/10"
                  : "border border-transparent hover:bg-white/5",
              )}
            >
              <span className="w-6 shrink-0 text-right text-sm font-semibold text-primary">
                {verse.verse}
              </span>
              <p className="flex-1 text-sm leading-relaxed text-foreground/80">{verse.text}</p>
              {queuedVerseKeys.has(`${verse.book_number}:${verse.chapter}:${verse.verse}`) ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="flex size-6 shrink-0 cursor-pointer items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation()
                          const store = useQueueStore.getState()
                          const idx = store.findDuplicate(
                            verse.book_number,
                            verse.chapter,
                            verse.verse,
                          )
                          if (idx !== -1) {
                            store.flashItem(store.items[idx].id)
                            document
                              .querySelector(`[data-slot="queue-panel"] [data-queue-idx="${idx}"]`)
                              ?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                          }
                        }}
                      >
                        <CheckIcon className="size-4 text-ai-direct" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left">Already in queue</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className={cn(
                          "shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
                          verse.id === effectiveSelectedVerseId
                            ? "hover:bg-lime-500/20 hover:text-lime-500"
                            : "bg-primary/40! text-primary-foreground hover:bg-primary!",
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          useQueueStore.getState().addOrFlashItem(
                            createScriptureQueueItem(verse, {
                              reference: `${verse.book_name} ${verse.chapter}:${verse.verse}`,
                              confidence: 1,
                              source: "manual",
                            }),
                          )
                        }}
                      >
                        <PlusIcon className="size-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">Add to queue</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
