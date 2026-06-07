type ClearContextSearchCache = (translationId?: number) => void

let clearLoadedCache: ClearContextSearchCache | null = null

export function registerContextSearchCacheClearer(
  clearCache: ClearContextSearchCache,
): void {
  clearLoadedCache = clearCache
}

export function clearLoadedContextSearchCache(translationId?: number): void {
  clearLoadedCache?.(translationId)
}
