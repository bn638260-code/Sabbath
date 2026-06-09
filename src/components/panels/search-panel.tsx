import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PanelHeader } from "@/components/ui/panel-header"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { Input } from "@/components/ui/input"
import { BookChapterBrowser } from "@/components/panels/search/BookChapterBrowser"
import { ContextSearchTab } from "@/components/panels/search/ContextSearchTab"
import { QuickVerseSearch } from "@/components/panels/search/QuickVerseSearch"
import { TranslationSelect } from "@/components/panels/search/TranslationSelect"
import { useContextVerseSearch } from "@/hooks/use-context-verse-search"
import { useQuickVerseSearch } from "@/hooks/use-quick-verse-search"
import { bibleActions } from "@/hooks/use-bible"
import { useBible } from "@/hooks/use-bible"
import { cn } from "@/lib/utils"
import {
  buildQueuedVerseKeys,
  chapterCountForBook,
  handleBookChapterKeyDown,
  resolveEffectiveVerseId,
} from "@/lib/search-panel-state"
import { selectPreviewVerse } from "@/lib/presentation-workflow"
import { useBibleStore } from "@/stores/bible-store"
import { useQueueStore } from "@/stores/queue-store"
import type { Book } from "@/types"
import { BookOpenIcon, SearchIcon, SparklesIcon } from "lucide-react"

type SearchTab = "book" | "context" | "egw"

const LazyEgwBrowser = lazy(() =>
  import("@/components/panels/egw-browser").then((mod) => ({
    default: mod.EgwBrowser,
  })),
)

export function SearchPanel({ embedded = false }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<SearchTab>("book")
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [chapter, setChapter] = useState(1)
  const [selectedVerseId, setSelectedVerseId] = useState<number | null>(null)

  const panelRef = useRef<HTMLDivElement>(null)

  const {
    translations,
    books,
    currentChapter,
    semanticResults,
    activeTranslationId,
    selectedVerse,
  } = useBible()

  const queueItems = useQueueStore((state) => state.items)
  const queuedVerseKeys = useMemo(() => buildQueuedVerseKeys(queueItems), [queueItems])

  const selectedBookNumber = selectedBook?.book_number
  const maxChapter = chapterCountForBook(selectedBook)

  const { contextQuery, handleContextSearch, clearContextQuery } = useContextVerseSearch({
    activeTab,
    activeTranslationId,
  })

  const {
    quickInput,
    setQuickInput,
    quickSuggestion,
    quickVersesList,
    shouldShowVerseDropdown,
    quickInputRef,
    handleQuickKeyDown,
    handleQuickVerseClick,
  } = useQuickVerseSearch({ books, activeTranslationId })

  const effectiveSelectedVerseId = useMemo(
    () => resolveEffectiveVerseId(selectedVerseId, currentChapter, selectedVerse),
    [currentChapter, selectedVerseId, selectedVerse],
  )

  useEffect(() => {
    let cancelled = false

    bibleActions.loadTranslations().catch(console.error)

    bibleActions
      .loadBooks()
      .then((loadedBooks) => {
        if (cancelled) return

        const availableBooks =
          loadedBooks.length > 0 ? loadedBooks : useBibleStore.getState().books
        const defaultBook =
          availableBooks.find((book) => book.book_number === 1) ??
          availableBooks[0] ??
          null

        if (!defaultBook) return
        setSelectedBook(defaultBook)
        setChapter(1)
        setSelectedVerseId(null)
      })
      .catch(console.error)

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedBookNumber && chapter >= 1) {
      bibleActions.loadChapter(selectedBookNumber, chapter).catch(console.error)
    }
  }, [selectedBookNumber, chapter, activeTranslationId])

  useEffect(() => {
    if (!selectedVerseId || !selectedVerse || currentChapter.length === 0) return
    const stillExists = currentChapter.some((verse) => verse.id === selectedVerseId)
    if (!stillExists) {
      const match = currentChapter.find((verse) => verse.verse === selectedVerse.verse)
      if (match && match.id !== selectedVerse.id) {
        selectPreviewVerse(match)
      }
    }
  }, [currentChapter, selectedVerseId, selectedVerse])

  const applyNavigationSelection = useCallback((book: Book, navChapter: number) => {
    setActiveTab("book")
    setSelectedBook(book)
    setChapter(navChapter)
  }, [])

  useEffect(() => {
    let lastHandledKey: string | null = null

    const unsubscribe = useBibleStore.subscribe((state) => {
      const pendingNavigation = state.pendingNavigation
      if (!pendingNavigation) {
        lastHandledKey = null
        return
      }

      const { bookNumber, chapter: navChapter, verse: navVerse } = pendingNavigation
      const pendingKey = `${bookNumber}:${navChapter}:${navVerse}`
      if (pendingKey === lastHandledKey) return

      const book = state.books.find((entry) => entry.book_number === bookNumber)
      if (!book) return

      lastHandledKey = pendingKey
      applyNavigationSelection(book, navChapter)

      bibleActions
        .loadChapter(bookNumber, navChapter)
        .then((verses) => {
          const target = verses.find((verse) => verse.verse === navVerse)
          if (target) {
            setSelectedVerseId(target.id)
            selectPreviewVerse(target)
            document
              .getElementById(`verse-${target.id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
          panelRef.current?.focus()
        })
        .catch(console.error)
        .finally(() => {
          useBibleStore.getState().setPendingNavigation(null)
        })
    })

    return unsubscribe
  }, [applyNavigationSelection])

  const handleVerseClick = useCallback((verse: Parameters<typeof selectPreviewVerse>[0]) => {
    setSelectedVerseId(verse.id)
    selectPreviewVerse(verse)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      handleBookChapterKeyDown(e, {
        currentChapter,
        effectiveSelectedVerseId,
        maxChapter,
        setChapter,
        setSelectedVerseId,
        onSelectVerse: handleVerseClick,
      })
    },
    [currentChapter, effectiveSelectedVerseId, handleVerseClick, maxChapter],
  )

  const handleChapterChange = useCallback((nextChapter: number) => {
    setChapter(nextChapter)
    setSelectedVerseId(null)
  }, [])

  return (
    <div
      ref={panelRef}
      data-slot="search-panel"
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden outline-none",
        embedded ? "flex-1" : "glass-panel min-h-0 flex-1",
      )}
      onKeyDown={activeTab === "book" ? handleKeyDown : undefined}
      tabIndex={-1}
    >
      <PanelHeader title="Search" icon={<SearchIcon className="size-3" />} step={5} />

      <div className="flex min-h-11 shrink-0 items-center gap-0 border-b border-white/5">
        <div className="flex items-center gap-1 px-3 py-1.5">
          <button
            data-tour="book-search"
            onClick={() => setActiveTab("book")}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              activeTab === "book"
                ? "border-lime-500/50 bg-lime-500/15"
                : "border-white/5 text-muted-foreground hover:text-foreground",
            )}
          >
            <BookOpenIcon
              className={cn(
                "size-3.5",
                activeTab === "book" ? "text-lime-400" : "text-muted-foreground",
              )}
            />
            Book search
          </button>
          <button
            data-tour="context-search"
            onClick={() => {
              setActiveTab("context")
              clearContextQuery()
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              activeTab === "context"
                ? "border-lime-500/50 bg-lime-500/15"
                : "border-white/5 bg-black/40 text-muted-foreground hover:text-foreground",
            )}
          >
            <SparklesIcon
              className={cn(
                "size-3.5",
                activeTab === "context" ? "text-lime-400" : "text-muted-foreground",
              )}
            />
            Context search
          </button>
          <button
            onClick={() => setActiveTab("egw")}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
              activeTab === "egw"
                ? "border-lime-500/50 bg-lime-500/15"
                : "border-white/5 text-muted-foreground hover:text-foreground",
            )}
          >
            <BookOpenIcon
              className={cn(
                "size-3.5",
                activeTab === "egw" ? "text-lime-400" : "text-muted-foreground",
              )}
            />
            EGW
          </button>
        </div>

        {activeTab === "book" ? (
          <div className="flex flex-1 items-center gap-2 pr-3">
            <QuickVerseSearch
              quickInput={quickInput}
              quickSuggestion={quickSuggestion}
              quickVersesList={quickVersesList}
              shouldShowVerseDropdown={shouldShowVerseDropdown}
              quickInputRef={quickInputRef}
              onQuickInputChange={setQuickInput}
              onQuickKeyDown={handleQuickKeyDown}
              onQuickVerseClick={handleQuickVerseClick}
            />
            <TranslationSelect
              translations={translations}
              activeTranslationId={activeTranslationId}
            />
          </div>
        ) : null}

        {activeTab === "context" ? (
          <div className="flex flex-1 items-center gap-2 pr-3">
            <Input
              placeholder="Search verse text..."
              value={contextQuery}
              onChange={(e) => handleContextSearch(e.target.value)}
              className="h-7 flex-1 text-xs"
            />
            <TranslationSelect
              translations={translations}
              activeTranslationId={activeTranslationId}
            />
          </div>
        ) : null}
      </div>

      {activeTab === "book" ? (
        <BookChapterBrowser
          selectedBook={selectedBook}
          chapter={chapter}
          maxChapter={maxChapter}
          currentChapter={currentChapter}
          effectiveSelectedVerseId={effectiveSelectedVerseId}
          queuedVerseKeys={queuedVerseKeys}
          onChapterChange={handleChapterChange}
          onSelectVerse={handleVerseClick}
        />
      ) : null}

      {activeTab === "context" ? (
        <ContextSearchTab
          contextQuery={contextQuery}
          semanticResults={semanticResults}
          activeTranslationId={activeTranslationId}
          queuedVerseKeys={queuedVerseKeys}
        />
      ) : null}

      {activeTab === "egw" ? (
        <Suspense
          fallback={
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <PanelEmptyState
                icon={<BookOpenIcon className="size-8" />}
                title="Loading EGW"
                description="Preparing the browser."
              />
            </div>
          }
        >
          <LazyEgwBrowser />
        </Suspense>
      ) : null}
    </div>
  )
}
