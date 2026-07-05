import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type KeyboardEvent,
} from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { ResultCard } from "@/components/panels/search/ResultCard"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react"
import { scrollIntoPanelView } from "@/lib/scroll-into-panel-view"
import { useEgw, egwActions } from "@/hooks/use-egw"
import { useTauriEvent } from "@/hooks/use-tauri-event"
import { useEgwStore } from "@/stores/egw-store"
import {
  createEgwQueueItem,
  egwReference,
  presentEgwParagraph,
  previewEgwParagraph,
} from "@/lib/presentation-workflow"
import { useQueueStore } from "@/stores/queue-store"
import type { EgwParagraph } from "@/types"

type EgwView = "browse" | "search"

export function EgwBrowser() {
  const {
    books,
    selectedBookNumber,
    chapters,
    selectedChapter,
    currentParagraphs,
    searchResults,
    selectedParagraphId,
    searchMode,
    semanticStatus,
    indexProgress,
  } = useEgw()

  const [view, setView] = useState<EgwView>("browse")
  const [searchInput, setSearchInput] = useState("")
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const selectedParagraphRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    egwActions
      .loadBooks()
      .then((loaded) => {
        if (loaded.length > 0 && useEgwStore.getState().selectedBookNumber === null) {
          useEgwStore.getState().setSelectedBookNumber(loaded[0].book_number)
        }
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (selectedBookNumber == null) return
    egwActions.loadChapters(selectedBookNumber).catch(console.error)
  }, [selectedBookNumber])

  useEffect(() => {
    if (selectedBookNumber == null) return
    egwActions.loadChapter(selectedBookNumber, selectedChapter).catch(console.error)
  }, [selectedBookNumber, selectedChapter])

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [])

  const chapterCount = useMemo(() => chapters.length, [chapters])
  const currentChapterTitle = useMemo(
    () => chapters.find((c) => c.chapter === selectedChapter)?.title ?? "",
    [chapters, selectedChapter]
  )

  const runSearch = useCallback((value: string) => {
    const mode = useEgwStore.getState().searchMode
    if (mode === "context") {
      egwActions.contextSearch(value, 20).catch(console.error)
    } else {
      egwActions.search(value, 20).catch(console.error)
    }
  }, [])

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value)
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
      if (value.trim().length >= 3) {
        searchDebounceRef.current = setTimeout(() => runSearch(value), 250)
      } else {
        useEgwStore.getState().setSearchResults([])
      }
    },
    [runSearch],
  )

  const handleModeChange = useCallback(
    (mode: "keyword" | "context") => {
      useEgwStore.getState().setSearchMode(mode)
      if (mode === "context") {
        egwActions.loadSemanticStatus().catch(console.error)
      }
      if (searchInput.trim().length >= 3) runSearch(searchInput)
    },
    [runSearch, searchInput],
  )

  useEffect(() => {
    if (view !== "search") return
    egwActions.loadSemanticStatus().catch(console.error)
  }, [view])

  useTauriEvent<{ embedded: number; total: number }>("egw-semantic-progress", (p) => {
    useEgwStore.getState().setIndexProgress(p)
  })
  useTauriEvent("egw-semantic-ready", () => {
    useEgwStore.getState().setIndexProgress(null)
    egwActions.loadSemanticStatus().catch(console.error)
    if (
      useEgwStore.getState().searchMode === "context" &&
      searchInput.trim().length >= 3
    ) {
      runSearch(searchInput)
    }
  })
  useTauriEvent<string>("egw-semantic-error", (message) => {
    useEgwStore.getState().setIndexProgress(null)
    egwActions.loadSemanticStatus().catch(console.error)
    console.error("[egw-semantic] index build failed:", message)
  })

  const handleParagraphClick = useCallback((p: EgwParagraph) => {
    useEgwStore.getState().setSelectedParagraphId(p.id)
    previewEgwParagraph(p)
  }, [])

  const goToChapter = useCallback(
    (chapter: number) => {
      if (chapter < 1 || (chapterCount > 0 && chapter > chapterCount)) return
      useEgwStore.getState().setSelectedChapter(chapter)
    },
    [chapterCount],
  )

  const moveParagraphSelection = useCallback(
    (direction: -1 | 1) => {
      const paragraphs = view === "browse" ? currentParagraphs : searchResults
      if (paragraphs.length === 0) return

      const currentIndex = paragraphs.findIndex((p) => p.id === selectedParagraphId)
      const nextIndex =
        currentIndex === -1
          ? direction > 0
            ? 0
            : paragraphs.length - 1
          : Math.min(Math.max(currentIndex + direction, 0), paragraphs.length - 1)
      const next = paragraphs[nextIndex]
      if (next) handleParagraphClick(next)
    },
    [currentParagraphs, handleParagraphClick, searchResults, selectedParagraphId, view],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null
      if (
        target?.closest("input, textarea, select, button, [role='combobox'], [contenteditable='true']")
      ) {
        return
      }

      const isChapterKey =
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "PageUp" ||
        event.key === "PageDown"

      if (isChapterKey && view === "browse") {
        event.preventDefault()
        event.stopPropagation()
        if (event.key === "ArrowLeft" || event.key === "PageUp") {
          goToChapter(selectedChapter - 1)
        } else {
          goToChapter(selectedChapter + 1)
        }
        return
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault()
        event.stopPropagation()
        moveParagraphSelection(event.key === "ArrowUp" ? -1 : 1)
      }
    },
    [goToChapter, moveParagraphSelection, selectedChapter, view],
  )

  useEffect(() => {
    if (view !== "browse") return
    panelRef.current?.focus({ preventScroll: true })
  }, [view, selectedBookNumber, selectedChapter])

  const focusPanel = useCallback(() => {
    panelRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    scrollIntoPanelView(selectedParagraphRef.current)
  }, [selectedParagraphId])

  const renderRow = (p: EgwParagraph) => (
    <ResultCard
      key={p.id}
      cardRef={p.id === selectedParagraphId ? selectedParagraphRef : undefined}
      reference={egwReference(p)}
      text={p.text}
      badgeLabel="EGW"
      badgeTone="egw"
      selected={p.id === selectedParagraphId}
      onPreview={() => handleParagraphClick(p)}
      onLive={() => presentEgwParagraph(p)}
      onQueue={() =>
        useQueueStore.getState().addOrFlashItem(createEgwQueueItem(p))
      }
    />
  )

  return (
    <div
      ref={panelRef}
      data-slot="egw-browser"
      className="flex min-h-0 flex-1 flex-col outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--border-subtle)] p-2">
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant={view === "browse" ? "default" : "outline"}
            onClick={() => setView("browse")}
          >
            <BookOpenIcon className="size-3.5" /> Browse
          </Button>
          <Button
            size="xs"
            variant={view === "search" ? "default" : "outline"}
            onClick={() => setView("search")}
          >
            <SearchIcon className="size-3.5" /> Search
          </Button>
        </div>

        {view === "browse" ? (
          <div className="flex items-center gap-2">
            <Select
              value={selectedBookNumber != null ? String(selectedBookNumber) : ""}
              onValueChange={(v) =>
                useEgwStore.getState().setSelectedBookNumber(Number(v))
              }
            >
              <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
                <SelectValue placeholder="Select a book" />
              </SelectTrigger>
              <SelectContent>
                {books.map((b) => (
                  <SelectItem key={b.book_number} value={String(b.book_number)}>
                    {b.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={selectedChapter <= 1}
                onClick={() => goToChapter(selectedChapter - 1)}
              >
                <ArrowLeftIcon className="size-3" />
              </Button>
              <span className="min-w-12 text-center text-xs font-medium">
                Ch {selectedChapter}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={chapterCount === 0 || selectedChapter >= chapterCount}
                onClick={() => goToChapter(selectedChapter + 1)}
              >
                <ArrowRightIcon className="size-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Input
              placeholder={
                searchMode === "context"
                  ? "Search EGW by meaning..."
                  : "Search EGW paragraphs..."
              }
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-7 flex-1 text-xs"
            />
            <Button
              size="xs"
              variant={searchMode === "keyword" ? "default" : "outline"}
              onClick={() => handleModeChange("keyword")}
            >
              <SearchIcon className="size-3.5" /> Keyword
            </Button>
            <Button
              size="xs"
              variant={searchMode === "context" ? "default" : "outline"}
              onClick={() => handleModeChange("context")}
            >
              <SparklesIcon className="size-3.5" /> Context
            </Button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" onMouseDown={focusPanel}>
        {view === "browse" ? (
          books.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <PanelEmptyState
                icon={<BookOpenIcon className="size-8" />}
                title="No EGW books installed"
                description="Add a book JSON to data/sources/egw and run bun run build:egw."
              />
            </div>
          ) : (
            <div className="flex flex-col gap-0 p-2">
              {currentChapterTitle && (
                <h3 className="px-1 py-2 text-sm font-semibold text-foreground">
                  {currentChapterTitle}
                </h3>
              )}
              {currentParagraphs.map((p) => renderRow(p))}
            </div>
          )
        ) : searchMode === "context" && semanticStatus && !semanticStatus.model_available ? (
          <div className="flex h-full items-center justify-center">
            <PanelEmptyState
              icon={<SparklesIcon className="size-8" />}
              title="Context search unavailable"
              description="The semantic model is not installed. Use keyword search instead."
            />
          </div>
        ) : searchMode === "context" && semanticStatus && !semanticStatus.ready ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <PanelEmptyState
              icon={<SparklesIcon className="size-8" />}
              title={semanticStatus.building ? "Building context index" : "Context index needed"}
              description={
                semanticStatus.building
                  ? indexProgress
                    ? `Embedding paragraphs: ${indexProgress.embedded} / ${indexProgress.total}`
                    : "Preparing the Ellen G. White library for meaning-based search."
                  : "One-time setup: index the Ellen G. White library for meaning-based search."
              }
            />
            {!semanticStatus.building ? (
              <Button
                size="xs"
                onClick={() => egwActions.buildSemanticIndex().catch(console.error)}
              >
                <SparklesIcon className="size-3.5" /> Build context index
              </Button>
            ) : null}
          </div>
        ) : searchInput.trim().length < 3 ? (
          <div className="flex h-full items-center justify-center">
            <PanelEmptyState
              icon={<SearchIcon className="size-8" />}
              title="Type to search"
              description={
                searchMode === "context"
                  ? "Describe a topic to find Ellen G. White passages by meaning."
                  : "Search Ellen G. White paragraphs by keyword."
              }
            />
          </div>
        ) : searchResults.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <PanelEmptyState
              icon={<SearchIcon className="size-8" />}
              title="No results found"
              description="Try a different keyword."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-0 p-2">
            {searchResults.map((p) => renderRow(p))}
          </div>
        )}
      </div>
    </div>
  )
}
