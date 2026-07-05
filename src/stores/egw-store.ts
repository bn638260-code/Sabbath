import { create } from "zustand"
import type { EgwBook, EgwChapterInfo, EgwParagraph, EgwSemanticStatus } from "@/types"

export type EgwSearchMode = "keyword" | "context"

interface EgwState {
  books: EgwBook[]
  selectedBookNumber: number | null
  chapters: EgwChapterInfo[]
  selectedChapter: number
  currentParagraphs: EgwParagraph[]
  searchResults: EgwParagraph[]
  selectedParagraphId: number | null
  searchMode: EgwSearchMode
  semanticStatus: EgwSemanticStatus | null
  indexProgress: { embedded: number; total: number } | null

  setBooks: (books: EgwBook[]) => void
  setSelectedBookNumber: (n: number | null) => void
  setChapters: (chapters: EgwChapterInfo[]) => void
  setSelectedChapter: (chapter: number) => void
  setCurrentParagraphs: (paragraphs: EgwParagraph[]) => void
  setSearchResults: (results: EgwParagraph[]) => void
  setSelectedParagraphId: (id: number | null) => void
  setSearchMode: (mode: EgwSearchMode) => void
  setSemanticStatus: (status: EgwSemanticStatus | null) => void
  setIndexProgress: (progress: { embedded: number; total: number } | null) => void
}

export const useEgwStore = create<EgwState>((set) => ({
  books: [],
  selectedBookNumber: null,
  chapters: [],
  selectedChapter: 1,
  currentParagraphs: [],
  searchResults: [],
  selectedParagraphId: null,
  searchMode: "keyword",
  semanticStatus: null,
  indexProgress: null,

  setBooks: (books) => set({ books }),
  setSelectedBookNumber: (selectedBookNumber) =>
    set({
      selectedBookNumber,
      selectedChapter: 1,
      chapters: [],
      currentParagraphs: [],
      selectedParagraphId: null,
    }),
  setChapters: (chapters) => set({ chapters }),
  setSelectedChapter: (selectedChapter) => set({ selectedChapter }),
  setCurrentParagraphs: (currentParagraphs) => set({ currentParagraphs }),
  setSearchResults: (searchResults) => set({ searchResults }),
  setSelectedParagraphId: (selectedParagraphId) => set({ selectedParagraphId }),
  setSearchMode: (searchMode) => set({ searchMode, searchResults: [] }),
  setSemanticStatus: (semanticStatus) => set({ semanticStatus }),
  setIndexProgress: (indexProgress) => set({ indexProgress }),
}))