import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"
import { Input } from "@/components/ui/input"
import { bibleActions } from "@/hooks/use-bible"
import {
  egwReference,
  previewEgwParagraph,
  selectPreviewVerse,
} from "@/lib/presentation-workflow"
import { useBibleStore } from "@/stores/bible-store"
import { useLibraryStore } from "@/stores/library-store"
import {
  getAutocompleteSuggestion,
  getGhostSuggestionSuffix,
  getTabNavigationResult,
  type Book as QuickSearchBook,
} from "@/lib/quick-search"
import {
  isPresentableLibraryAsset,
  previewLibraryAsset,
} from "@/lib/library/library-presentation"
import { searchHymns } from "@/services/hymnal/hymnal-repository"
import { loadHymnVoiceControl } from "@/services/hymnal/hymn-voice-control-loader"
import { BookOpenIcon, LibraryIcon, Music2Icon, SearchIcon } from "lucide-react"
import { invokeTauri } from "@/lib/tauri-runtime"
import type { EgwParagraph, Verse } from "@/types"
import type { LibraryAsset } from "@/types/library"

const QUICK_PREVIEW_DEBOUNCE_MS = 120

function quickContentQuery(value: string): string {
  return value.replace(/^(?:hymn|song)\s+(?:number\s+)?/i, "").trim()
}

function librarySearchText(asset: LibraryAsset): string {
  return [asset.name, asset.type, ...(asset.tags ?? [])].join(" ").toLowerCase()
}

function quickAssetLabel(asset: LibraryAsset): string {
  if (asset.type === "slide-template") return "Slides"
  return asset.type.charAt(0).toUpperCase() + asset.type.slice(1)
}

export function PreviewQuickSearch() {
  const books = useBibleStore((s) => s.books)
  const activeTranslationId = useBibleStore((s) => s.activeTranslationId)
  const assets = useLibraryStore((s) => s.assets)
  const [query, setQuery] = useState("")
  const [feedback, setFeedback] = useState("")
  const [verseMatches, setVerseMatches] = useState<Verse[]>([])
  const [egwMatches, setEgwMatches] = useState<EgwParagraph[]>([])
  const requestIdRef = useRef(0)
  const verseSearchRequestIdRef = useRef(0)
  const egwRequestIdRef = useRef(0)

  const trimmedQuery = query.trim()
  const bibleResult = useMemo(
    () => getAutocompleteSuggestion(query, books as QuickSearchBook[]),
    [books, query]
  )
  const ghostSuggestionSuffix = getGhostSuggestionSuffix(
    query,
    bibleResult.suggestion
  )
  const hymnQuery = useMemo(() => quickContentQuery(query), [query])
  const hymnMatches = useMemo(
    () => (hymnQuery ? searchHymns(hymnQuery, 3) : []),
    [hymnQuery]
  )
  const libraryMatches = useMemo(() => {
    const q = (hymnQuery || trimmedQuery).toLowerCase()
    if (!q) return []
    return assets
      .filter(isPresentableLibraryAsset)
      .filter((asset) => librarySearchText(asset).includes(q))
      .slice(0, 3)
  }, [assets, hymnQuery, trimmedQuery])

  useEffect(() => {
    if (books.length > 0) return
    void bibleActions.loadBooks(activeTranslationId)
  }, [activeTranslationId, books.length])

  useEffect(() => {
    const q = trimmedQuery
    const requestId = ++verseSearchRequestIdRef.current
    const timer = setTimeout(() => {
      if (
        q.length < 3 ||
        bibleResult.stage !== "none" ||
        /^(?:hymn|song)\b/i.test(q)
      ) {
        if (requestId === verseSearchRequestIdRef.current) setVerseMatches([])
        return
      }
      void invokeTauri<Verse[]>("search_verses", {
        query: q,
        translationId: activeTranslationId,
        limit: 3,
      })
        .then((results) => {
          if (requestId === verseSearchRequestIdRef.current)
            setVerseMatches(results)
        })
        .catch(() => {
          if (requestId === verseSearchRequestIdRef.current) setVerseMatches([])
        })
    }, QUICK_PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [activeTranslationId, bibleResult.stage, trimmedQuery])

  // Search Ellen G. White paragraphs directly (without touching the EGW
  // browser's stored results) so they can be previewed from the quick box.
  useEffect(() => {
    const q = hymnQuery || trimmedQuery
    const requestId = ++egwRequestIdRef.current
    const timer = setTimeout(() => {
      if (q.length < 3) {
        if (requestId === egwRequestIdRef.current) setEgwMatches([])
        return
      }
      void invokeTauri<EgwParagraph[]>("egw_search", { query: q, limit: 3 })
        .then((results) => {
          if (requestId === egwRequestIdRef.current) setEgwMatches(results)
        })
        .catch(() => {
          if (requestId === egwRequestIdRef.current) setEgwMatches([])
        })
    }, QUICK_PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [hymnQuery, trimmedQuery])

  // Any query change invalidates in-flight preview fetches so a debounced
  // response can't stage a verse after the input was cleared or retyped (M1).
  useEffect(() => {
    requestIdRef.current += 1
  }, [query])

  const previewVerseReference = useCallback(
    async (
      bookNumber: number,
      chapter: number,
      verse: number,
      options?: { clearQuery?: boolean }
    ) => {
      const requestId = ++requestIdRef.current
      setFeedback("Previewing verse...")
      const result = await bibleActions.fetchVerse(
        bookNumber,
        chapter,
        verse,
        activeTranslationId
      )
      if (requestId !== requestIdRef.current) return
      if (!result) {
        setFeedback("Verse not found")
        return
      }
      selectPreviewVerse(result)
      if (options?.clearQuery) {
        setQuery("")
        setFeedback("")
        return
      }
      setFeedback(
        `Previewed ${result.book_name} ${result.chapter}:${result.verse}`
      )
    },
    [activeTranslationId]
  )

  useEffect(() => {
    if (
      bibleResult.stage !== "complete" ||
      !bibleResult.matchedBook ||
      !bibleResult.chapter ||
      !bibleResult.verse
    ) {
      return
    }

    const timer = setTimeout(() => {
      void previewVerseReference(
        bibleResult.matchedBook!.book_number,
        bibleResult.chapter!,
        bibleResult.verse!
      )
    }, QUICK_PREVIEW_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [
    bibleResult.chapter,
    bibleResult.matchedBook,
    bibleResult.stage,
    bibleResult.verse,
    previewVerseReference,
  ])

  const previewHymn = useCallback(async (number: number) => {
    const requestId = ++requestIdRef.current
    setFeedback(`Previewing hymn ${number}...`)
    const mod = await loadHymnVoiceControl()
    await mod.previewHymnByNumber(number)
    if (requestId !== requestIdRef.current) return
    setQuery("")
    setFeedback("")
  }, [])

  const previewVerseMatch = useCallback((verse: Verse) => {
    selectPreviewVerse(verse)
    setQuery("")
    setFeedback("")
    setVerseMatches([])
  }, [])

  const previewAsset = useCallback((asset: LibraryAsset) => {
    previewLibraryAsset(asset)
    setQuery("")
    setFeedback("")
  }, [])

  const previewEgw = useCallback((paragraph: EgwParagraph) => {
    previewEgwParagraph(paragraph)
    setQuery("")
    setFeedback("")
  }, [])

  const previewFirstMatch = useCallback(() => {
    if (
      bibleResult.stage === "complete" &&
      bibleResult.matchedBook &&
      bibleResult.chapter &&
      bibleResult.verse
    ) {
      void previewVerseReference(
        bibleResult.matchedBook.book_number,
        bibleResult.chapter,
        bibleResult.verse,
        { clearQuery: true }
      )
      return
    }
    const verseMatch = verseMatches[0]
    if (verseMatch) {
      previewVerseMatch(verseMatch)
      return
    }
    const hymn = hymnMatches[0]
    if (hymn) {
      void previewHymn(hymn.number)
      return
    }
    const asset = libraryMatches[0]
    if (asset) {
      previewAsset(asset)
      return
    }
    const egw = egwMatches[0]
    if (egw) previewEgw(egw)
  }, [
    bibleResult.chapter,
    bibleResult.matchedBook,
    bibleResult.stage,
    bibleResult.verse,
    egwMatches,
    hymnMatches,
    libraryMatches,
    previewAsset,
    previewEgw,
    previewHymn,
    previewVerseMatch,
    previewVerseReference,
    verseMatches,
  ])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      (event.key === "Tab" || event.key === "ArrowRight") &&
      bibleResult.suggestion &&
      bibleResult.suggestion !== query
    ) {
      event.preventDefault()
      setQuery(getTabNavigationResult(query, bibleResult.suggestion))
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      previewFirstMatch()
      return
    }

    if (event.key === "Escape") {
      event.preventDefault()
      setQuery("")
      setFeedback("")
      setVerseMatches([])
    }
  }

  const showDropdown =
    trimmedQuery.length > 0 &&
    (bibleResult.stage === "complete" ||
      verseMatches.length > 0 ||
      hymnMatches.length > 0 ||
      libraryMatches.length > 0 ||
      egwMatches.length > 0 ||
      Boolean(feedback))

  return (
    <div className="relative w-full min-w-[13rem] sm:w-72 xl:w-80">
      {/* The real input renders the typed text; the overlay reuses it as an
          invisible spacer so only the grey suggestion suffix is drawn after it. */}
      {ghostSuggestionSuffix ? (
        <div
          data-testid="quick-search-ghost"
          className="pointer-events-none absolute inset-0 z-10 flex items-center px-8"
        >
          <span className="truncate text-xs">
            <span className="invisible">{query}</span>
            <span className="text-muted-foreground">
              {ghostSuggestionSuffix}
            </span>
          </span>
        </div>
      ) : null}
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 z-20 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setFeedback("")
        }}
        onKeyDown={handleKeyDown}
        placeholder="Quick preview: John 3:16, hymn 46"
        className="h-8 rounded-md border-[var(--border-subtle)] bg-[var(--shell-code-bg)] pr-2 pl-8 text-xs"
      />

      {showDropdown ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--shell-bg-elevated)] text-foreground shadow-lg backdrop-blur-md">
          {bibleResult.stage === "complete" &&
          bibleResult.matchedBook &&
          bibleResult.chapter &&
          bibleResult.verse ? (
            <button
              type="button"
              onClick={() =>
                void previewVerseReference(
                  bibleResult.matchedBook!.book_number,
                  bibleResult.chapter!,
                  bibleResult.verse!,
                  { clearQuery: true }
                )
              }
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
            >
              <BookOpenIcon className="size-3.5 text-lime-700 dark:text-lime-400" />
              <span className="min-w-0 flex-1 truncate">
                Preview {bibleResult.matchedBook.name} {bibleResult.chapter}:
                {bibleResult.verse}
              </span>
            </button>
          ) : null}
          {verseMatches.map((verse) => (
            <button
              key={verse.id}
              type="button"
              onClick={() => previewVerseMatch(verse)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
            >
              <BookOpenIcon className="size-3.5 text-lime-700 dark:text-lime-400" />
              <span className="shrink-0">
                {verse.book_name} {verse.chapter}:{verse.verse}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {verse.text}
              </span>
            </button>
          ))}
          {hymnMatches.map((hymn) => (
            <button
              key={hymn.id}
              type="button"
              onClick={() => void previewHymn(hymn.number)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
            >
              <Music2Icon className="size-3.5 text-amber-700 dark:text-amber-300" />
              <span className="min-w-0 flex-1 truncate">
                #{hymn.number} {hymn.title}
              </span>
            </button>
          ))}
          {libraryMatches.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => previewAsset(asset)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
            >
              <LibraryIcon className="size-3.5 text-sky-700 dark:text-sky-300" />
              <span className="min-w-0 flex-1 truncate">{asset.name}</span>
              <span className="shrink-0 text-[0.625rem] text-muted-foreground">
                {quickAssetLabel(asset)}
              </span>
            </button>
          ))}
          {egwMatches.map((paragraph) => (
            <button
              key={paragraph.id}
              type="button"
              onClick={() => previewEgw(paragraph)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
            >
              <BookOpenIcon className="size-3.5 text-violet-700 dark:text-violet-300" />
              <span className="min-w-0 flex-1 truncate">
                {egwReference(paragraph)}
              </span>
              <span className="shrink-0 text-[0.625rem] text-muted-foreground">
                EGW
              </span>
            </button>
          ))}
          {feedback ? (
            <div className="border-t border-[var(--border-subtle)] px-2 py-1 text-[0.625rem] text-muted-foreground">
              {feedback}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
