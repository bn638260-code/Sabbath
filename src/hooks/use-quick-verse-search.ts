import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { invokeTauri } from "@/lib/tauri-runtime"
import { useBibleStore } from "@/stores/bible-store"
import {
  getAutocompleteSuggestion,
  getTabNavigationResult,
  type Book as QuickSearchBook,
} from "@/lib/quick-search"
import type { Book, Verse } from "@/types"

export const QUICK_CHAPTER_LOAD_DEBOUNCE_MS = 90

export type QuickSearchKeyDownOptions = {
  quickInput: string
  quickSuggestion: string
  setQuickInput: (value: string) => void
  clearQuickSearch: () => void
}

export function handleQuickSearchKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>,
  options: QuickSearchKeyDownOptions,
): void {
  const { quickInput, quickSuggestion, setQuickInput, clearQuickSearch } = options

  if (
    (e.key === "Tab" || e.key === "ArrowRight") &&
    quickSuggestion &&
    quickSuggestion !== quickInput
  ) {
    e.preventDefault()
    setQuickInput(getTabNavigationResult(quickInput, quickSuggestion))
    return
  }

  if (e.key === "Enter") {
    e.preventDefault()
    clearQuickSearch()
    return
  }

  if (e.key === "Escape") {
    e.preventDefault()
    clearQuickSearch()
  }
}

export function useQuickVerseSearch(options: {
  books: Book[]
  activeTranslationId: number
  onVerseSelected?: (verse: Verse) => void
}) {
  const { books, activeTranslationId, onVerseSelected } = options
  const [quickInput, setQuickInput] = useState("")
  const [showQuickVerses, setShowQuickVerses] = useState(false)
  const [quickVersesList, setQuickVersesList] = useState<Verse[]>([])

  const quickInputRef = useRef<HTMLInputElement>(null)
  const quickVerseDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const quickVerseRequestIdRef = useRef(0)

  const autocompleteResult = useMemo(
    () => getAutocompleteSuggestion(quickInput, books as QuickSearchBook[]),
    [quickInput, books],
  )
  const quickSuggestion = autocompleteResult.suggestion

  const clearQuickSearch = useCallback(() => {
    setQuickInput("")
    setShowQuickVerses(false)
  }, [])

  useEffect(() => {
    const result = autocompleteResult

    if (result.stage === "complete" && result.matchedBook && result.chapter && result.verse) {
      useBibleStore.getState().setPendingNavigation({
        bookNumber: result.matchedBook.book_number,
        chapter: result.chapter,
        verse: result.verse,
      })

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (quickInputRef.current && document.activeElement !== quickInputRef.current) {
            quickInputRef.current.focus()
          }
        })
      })
    }

    if (
      (result.stage === "chapter" || result.stage === "verse") &&
      result.matchedBook &&
      result.chapter
    ) {
      const requestId = ++quickVerseRequestIdRef.current
      if (quickVerseDebounceRef.current) clearTimeout(quickVerseDebounceRef.current)
      quickVerseDebounceRef.current = setTimeout(() => {
        invokeTauri<Verse[]>("get_chapter", {
          translationId: activeTranslationId,
          bookNumber: result.matchedBook!.book_number,
          chapter: result.chapter!,
        })
          .then((verses) => {
            if (requestId !== quickVerseRequestIdRef.current) return
            setQuickVersesList(verses)
            setShowQuickVerses(true)
          })
          .catch(console.error)
      }, QUICK_CHAPTER_LOAD_DEBOUNCE_MS)
    } else {
      quickVerseRequestIdRef.current += 1
      if (quickVerseDebounceRef.current) clearTimeout(quickVerseDebounceRef.current)
    }
  }, [autocompleteResult, activeTranslationId])

  useEffect(() => {
    return () => {
      if (quickVerseDebounceRef.current) clearTimeout(quickVerseDebounceRef.current)
    }
  }, [])

  const shouldShowVerseDropdown =
    showQuickVerses &&
    (autocompleteResult.stage === "chapter" || autocompleteResult.stage === "verse")

  const handleQuickKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      handleQuickSearchKeyDown(e, {
        quickInput,
        quickSuggestion,
        setQuickInput,
        clearQuickSearch,
      })
    },
    [clearQuickSearch, quickInput, quickSuggestion],
  )

  const handleQuickVerseClick = useCallback(
    (verse: Verse) => {
      useBibleStore.getState().setPendingNavigation({
        bookNumber: verse.book_number,
        chapter: verse.chapter,
        verse: verse.verse,
      })
      onVerseSelected?.(verse)
      setQuickInput("")
      setShowQuickVerses(false)
    },
    [onVerseSelected],
  )

  return {
    quickInput,
    setQuickInput,
    quickSuggestion,
    quickVersesList,
    shouldShowVerseDropdown,
    quickInputRef,
    handleQuickKeyDown,
    handleQuickVerseClick,
  }
}
