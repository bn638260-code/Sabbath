import { create } from "zustand"
import type { EgwBook, EgwChapterInfo, EgwParagraph } from "@/types"

interface EgwState {
  books: EgwBook[]
  selectedBookNumber: number | null
  chapters: EgwChapterInfo[]
  selectedChapter: number
  currentParagraphs: EgwParagraph[]
  searchResults: EgwParagraph[]
  selectedParagraphId: number | null

  setBooks: (books: EgwBook[]) => void
  setSelectedBookNumber: (n: number | null) => void
  setChapters: (chapters: EgwChapterInfo[]) => void
  setSelectedChapter: (chapter: number) => void
  setCurrentParagraphs: (paragraphs: EgwParagraph[]) => void
  setSearchResults: (results: EgwParagraph[]) => void
  setSelectedParagraphId: (id: number | null) => void
}

export const useEgwStore = create<EgwState>((set) => ({
  books: [],
  selectedBookNumber: null,
  chapters: [],
  selectedChapter: 1,
  currentParagraphs: [],
  searchResults: [],
  selectedParagraphId: null,

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
}))