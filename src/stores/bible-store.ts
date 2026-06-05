import { create } from "zustand"
import { load } from "@tauri-apps/plugin-store"
import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"
import type { Translation, Book, Verse, CrossReference } from "@/types"
import type { SemanticSearchResult } from "@/types/detection"
import { clearContextSearchCache } from "@/lib/context-search"

/** Backend's own default active translation (see src-tauri/src/state.rs). Used only as a last resort to keep frontend and backend aligned. */
const DEFAULT_TRANSLATION_ID = 1

interface PendingNavigation {
  bookNumber: number
  chapter: number
  verse: number
}

interface BibleState {
  translations: Translation[]
  activeTranslationId: number
  books: Book[]
  searchResults: Verse[]
  semanticResults: SemanticSearchResult[]
  selectedVerse: Verse | null
  currentChapter: Verse[]
  crossReferences: CrossReference[]
  pendingNavigation: PendingNavigation | null

  setTranslations: (translations: Translation[]) => void
  setActiveTranslation: (id: number) => void
  setBooks: (books: Book[]) => void
  setSearchResults: (results: Verse[]) => void
  setSemanticResults: (results: SemanticSearchResult[]) => void
  selectVerse: (verse: Verse | null) => void
  setCurrentChapter: (verses: Verse[]) => void
  setCrossReferences: (refs: CrossReference[]) => void
  setPendingNavigation: (nav: PendingNavigation | null) => void
}

export const useBibleStore = create<BibleState>((set) => ({
  translations: [],
  activeTranslationId: 1, // KJV default
  books: [],
  searchResults: [],
  semanticResults: [],
  selectedVerse: null,
  currentChapter: [],
  crossReferences: [],
  pendingNavigation: null,

  setTranslations: (translations) => {
    clearContextSearchCache()
    set({ translations })
  },
  setActiveTranslation: (activeTranslationId) =>
    set((state) => {
      if (state.activeTranslationId === activeTranslationId) return state
      clearContextSearchCache()
      return { activeTranslationId }
    }),
  setBooks: (books) => {
    clearContextSearchCache()
    set({ books })
  },
  setSearchResults: (searchResults) => set({ searchResults }),
  setSemanticResults: (semanticResults) => set({ semanticResults }),
  selectVerse: (selectedVerse) => set({ selectedVerse }),
  setCurrentChapter: (currentChapter) => set({ currentChapter }),
  setCrossReferences: (crossReferences) => set({ crossReferences }),
  setPendingNavigation: (pendingNavigation) => set({ pendingNavigation }),
}))

/** Load persisted activeTranslationId from disk into Zustand, then sync to Rust backend. */
export async function hydrateBibleStore(): Promise<void> {
  if (!isTauriRuntime()) return

  try {
    const store = await load("bible.json", { autoSave: false, defaults: {} })
    const value = await store.get<number>("activeTranslationId")
    if (typeof value === "number") {
      useBibleStore.getState().setActiveTranslation(value)
    }
    await invokeTauri("set_active_translation", {
      translationId: useBibleStore.getState().activeTranslationId,
    })
  } catch {
    console.warn("[bible] Failed to hydrate bible store; re-syncing to backend")
    await resyncActiveTranslationFromBackend()
  }
}

/** Resolve the active translation from the backend (or KJV by abbreviation) without hardcoding an id. */
async function resyncActiveTranslationFromBackend(): Promise<void> {
  try {
    const backendId = await invokeTauri<number>("get_active_translation")
    if (typeof backendId === "number") {
      useBibleStore.getState().setActiveTranslation(backendId)
      return
    }
  } catch {
    // fall through to abbreviation-based resolution
  }
  let translations = useBibleStore.getState().translations
  if (translations.length === 0) {
    try {
      translations =
        (await invokeTauri<Translation[]>("list_translations")) ?? []
      useBibleStore.getState().setTranslations(translations)
    } catch {
      // ignore — handled by last-resort fallback below
    }
  }

  const fallback =
    translations.find((t) => t.abbreviation === "KJV") ?? translations[0]
  if (fallback) {
    useBibleStore.getState().setActiveTranslation(fallback.id)
    return
  }

  // Last resort: align with the backend's own default so the two never desync.
  useBibleStore.getState().setActiveTranslation(DEFAULT_TRANSLATION_ID)
}

/** Subscribe to activeTranslationId changes and persist to disk with debounce. */
export async function initBiblePersistence(): Promise<void> {
  if (!isTauriRuntime()) return

  try {
    const store = await load("bible.json", { autoSave: false, defaults: {} })
    let timer: ReturnType<typeof setTimeout> | null = null
    useBibleStore.subscribe((state, prevState) => {
      const id = state.activeTranslationId
      if (id === prevState.activeTranslationId) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        await store.set("activeTranslationId", id)
        await store.save()
      }, 500)
    })
  } catch {
    console.warn("[bible] Failed to init persistence subscription")
  }
}
