import { useEffect, useState, useCallback, useMemo, useRef } from "react"
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
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useEgw, egwActions } from "@/hooks/use-egw"
import { useEgwStore } from "@/stores/egw-store"
import {
  createEgwQueueItem,
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
  } = useEgw()

  const [view, setView] = useState<EgwView>("browse")
  const [searchInput, setSearchInput] = useState("")
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (value.trim().length >= 3) {
      searchDebounceRef.current = setTimeout(() => {
        egwActions.search(value, 20).catch(console.error)
      }, 250)
    } else {
      useEgwStore.getState().setSearchResults([])
    }
  }, [])

  const handleParagraphClick = useCallback((p: EgwParagraph) => {
    useEgwStore.getState().setSelectedParagraphId(p.id)
    previewEgwParagraph(p)
  }, [])

  const renderRow = (p: EgwParagraph, showRef: boolean) => (
    <div
      key={p.id}
      onClick={() => handleParagraphClick(p)}
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-lg p-3 transition-colors",
        p.id === selectedParagraphId
          ? "border border-lime-500/50 bg-lime-500/10"
          : "border border-transparent hover:bg-muted/50"
      )}
    >
      <span className="w-8 shrink-0 text-right text-sm font-semibold text-primary">
        {showRef ? `${p.chapter}:${p.paragraph}` : p.paragraph}
      </span>
      <div className="flex-1">
        {showRef && (
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            {p.book_title} — {p.chapter_title}
          </div>
        )}
        <p className="text-sm leading-relaxed text-foreground/80">{p.text}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-xs"
          title="Present"
          onClick={(e) => {
            e.stopPropagation()
            presentEgwParagraph(p)
          }}
        >
          <ArrowRightIcon className="size-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          title="Add to queue"
          onClick={(e) => {
            e.stopPropagation()
            useQueueStore.getState().addOrFlashItem(createEgwQueueItem(p))
          }}
        >
          <PlusIcon className="size-3" />
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b border-border p-2">
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
                onClick={() =>
                  useEgwStore
                    .getState()
                    .setSelectedChapter(Math.max(1, selectedChapter - 1))
                }
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
                onClick={() =>
                  useEgwStore.getState().setSelectedChapter(selectedChapter + 1)
                }
              >
                <ArrowRightIcon className="size-3" />
              </Button>
            </div>
          </div>
        ) : (
          <Input
            placeholder="Search EGW paragraphs..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-7 text-xs"
          />
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
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
              {currentParagraphs.map((p) => renderRow(p, false))}
            </div>
          )
        ) : searchInput.trim().length < 3 ? (
          <div className="flex h-full items-center justify-center">
            <PanelEmptyState
              icon={<SearchIcon className="size-8" />}
              title="Type to search"
              description="Search Ellen G. White paragraphs by keyword."
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
            {searchResults.map((p) => renderRow(p, true))}
          </div>
        )}
      </div>
    </div>
  )
}