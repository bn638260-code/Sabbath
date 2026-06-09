import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { createScriptureQueueItem, selectPreviewVerse } from "@/lib/presentation-workflow"
import { useQueueStore } from "@/stores/queue-store"
import type { SemanticSearchResult, Verse } from "@/types"
import { CheckIcon, PlusIcon, SparklesIcon } from "lucide-react"
import { CONTEXT_SEARCH_MIN_QUERY_LENGTH } from "@/hooks/use-context-verse-search"

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>

  const queryWords = new Set(
    query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= 2),
  )
  if (queryWords.size === 0) return <>{text}</>

  const parts = text.split(/(\s+)/)
  return (
    <>
      {parts.map((part, index) => {
        const cleaned = part.toLowerCase().replace(/[^a-z']/g, "")
        if (cleaned.length >= 2 && queryWords.has(cleaned)) {
          return (
            <mark
              key={index}
              className="rounded-[2px] bg-emerald-800/90 px-0.5 text-foreground"
            >
              {part}
            </mark>
          )
        }
        return <span key={index}>{part}</span>
      })}
    </>
  )
}

export function ContextSearchTab({
  contextQuery,
  semanticResults,
  activeTranslationId,
  queuedVerseKeys,
}: {
  contextQuery: string
  semanticResults: SemanticSearchResult[]
  activeTranslationId: number
  queuedVerseKeys: Set<string>
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-0 p-2">
        {contextQuery.length < CONTEXT_SEARCH_MIN_QUERY_LENGTH ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <PanelEmptyState
              icon={<SparklesIcon className="size-8" />}
              title="Type to search"
              description="Search by meaning — type a phrase, paraphrase, or topic..."
            />
          </div>
        ) : null}
        {contextQuery.length >= CONTEXT_SEARCH_MIN_QUERY_LENGTH && semanticResults.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <PanelEmptyState
              icon={<SparklesIcon className="size-8" />}
              title="No results found"
              description="Try a different phrase, paraphrase, or topic."
            />
          </div>
        ) : null}
        {semanticResults.map((result, index) => (
          <div
            key={`${result.book_number}-${result.chapter}-${result.verse}-${index}`}
            onClick={() => {
              selectPreviewVerse({
                id: 0,
                translation_id: activeTranslationId,
                book_number: result.book_number,
                book_name: result.book_name,
                book_abbreviation: "",
                chapter: result.chapter,
                verse: result.verse,
                text: result.verse_text,
              })
            }}
            className="group relative flex cursor-pointer flex-col gap-1 rounded-lg p-3 transition-colors hover:bg-white/5"
          >
            <div className="flex shrink-0 flex-row items-start gap-2">
              <span className="text-xs font-semibold">
                {result.book_name} {result.chapter}:{result.verse}
              </span>
              <span className="mt-0.5 text-[0.5rem] text-muted-foreground">
                {Math.round(result.similarity * 100)}%
              </span>
            </div>
            <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
              <HighlightedText text={result.verse_text} query={contextQuery} />
            </p>
            {queuedVerseKeys.has(`${result.book_number}:${result.chapter}:${result.verse}`) ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="absolute top-1/2 right-2 flex size-6 shrink-0 -translate-y-1/2 cursor-pointer items-center justify-center"
                      onClick={(e) => {
                        e.stopPropagation()
                        const store = useQueueStore.getState()
                        const idx = store.findDuplicate(
                          result.book_number,
                          result.chapter,
                          result.verse,
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
                      className="absolute top-1/2 right-2 shrink-0 bg-primary text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/80"
                      onClick={(e) => {
                        e.stopPropagation()
                        const queueVerse: Verse = {
                          id: 0,
                          translation_id: activeTranslationId,
                          book_number: result.book_number,
                          book_name: result.book_name,
                          book_abbreviation: "",
                          chapter: result.chapter,
                          verse: result.verse,
                          text: result.verse_text,
                        }
                        useQueueStore.getState().addOrFlashItem(
                          createScriptureQueueItem(queueVerse, {
                            reference: `${result.book_name} ${result.chapter}:${result.verse}`,
                            confidence: result.similarity,
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
  )
}
