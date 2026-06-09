import { useCallback, useEffect, useRef, useState } from "react"
import { invokeTauri } from "@/lib/tauri-runtime"
import { useBibleStore } from "@/stores/bible-store"
import type { SemanticSearchResult } from "@/types"

export const CONTEXT_SEARCH_MIN_QUERY_LENGTH = 5
export const CONTEXT_SEARCH_DEBOUNCE_MS = 280
export const CONTEXT_SEARCH_TRANSLATION_DEBOUNCE_MS = 120

type ContextSearchModule = typeof import("@/lib/context-search")

export type RunContextVerseSearchDeps = {
  invoke: typeof invokeTauri
  importContextSearch: () => Promise<ContextSearchModule | null>
  setSemanticResults: (results: SemanticSearchResult[]) => void
  isStale: () => boolean
}

export async function runContextVerseSearch(
  query: string,
  translationId: number,
  deps: RunContextVerseSearchDeps,
): Promise<void> {
  const contextSearchModulePromise = deps.importContextSearch().catch((e) => {
    console.error("[context-search] fallback module import failed", e)
    return null
  })

  const hybridResultsPromise = deps
    .invoke<SemanticSearchResult[]>("semantic_search", { query, limit: 15 })
    .catch((e) => {
      console.error("[context-search] hybrid semantic_search failed", e)
      return null
    })

  const hybridResults = await hybridResultsPromise
  if (deps.isStale()) return

  const contextSearchModule = await contextSearchModulePromise
  if (deps.isStale()) return

  if (!contextSearchModule) {
    deps.setSemanticResults(hybridResults ?? [])
    return
  }

  const { mergeContextSearchResults, searchContextWithFuse } = contextSearchModule
  const fuseResults = await searchContextWithFuse(query, translationId, 15).catch(() => [])
  if (deps.isStale()) return

  deps.setSemanticResults(
    mergeContextSearchResults(hybridResults ?? [], fuseResults, 15),
  )
}

export function useContextVerseSearch(options: {
  activeTab: "book" | "context" | "egw"
  activeTranslationId: number
}) {
  const { activeTab, activeTranslationId } = options
  const [contextQuery, setContextQuery] = useState("")
  const contextDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contextSearchRequestIdRef = useRef(0)

  const runContextSearch = useCallback(async (query: string, translationId: number) => {
    const requestId = ++contextSearchRequestIdRef.current
    const isStale = () => requestId !== contextSearchRequestIdRef.current

    await runContextVerseSearch(query, translationId, {
      invoke: invokeTauri,
      importContextSearch: () => import("@/lib/context-search"),
      setSemanticResults: (results) => useBibleStore.getState().setSemanticResults(results),
      isStale,
    })
  }, [])

  const handleContextSearch = useCallback(
    (query: string) => {
      setContextQuery(query)
      if (contextDebounceRef.current) clearTimeout(contextDebounceRef.current)
      if (query.length >= CONTEXT_SEARCH_MIN_QUERY_LENGTH) {
        const translationId = useBibleStore.getState().activeTranslationId
        contextDebounceRef.current = setTimeout(() => {
          runContextSearch(query, translationId).catch(console.error)
        }, CONTEXT_SEARCH_DEBOUNCE_MS)
      } else {
        contextSearchRequestIdRef.current += 1
        useBibleStore.getState().setSemanticResults([])
      }
    },
    [runContextSearch],
  )

  useEffect(() => {
    if (activeTab !== "context" || contextQuery.length < CONTEXT_SEARCH_MIN_QUERY_LENGTH) return
    if (contextDebounceRef.current) clearTimeout(contextDebounceRef.current)
    contextDebounceRef.current = setTimeout(() => {
      runContextSearch(contextQuery, activeTranslationId).catch(console.error)
    }, CONTEXT_SEARCH_TRANSLATION_DEBOUNCE_MS)
  }, [activeTranslationId, activeTab, contextQuery, runContextSearch])

  useEffect(() => {
    return () => {
      if (contextDebounceRef.current) clearTimeout(contextDebounceRef.current)
    }
  }, [])

  const clearContextQuery = useCallback(() => {
    setContextQuery("")
  }, [])

  return {
    contextQuery,
    handleContextSearch,
    clearContextQuery,
  }
}
