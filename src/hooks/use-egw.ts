import { useEgwStore } from "@/stores/egw-store"
import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"
import type { EgwBook, EgwChapterInfo, EgwParagraph } from "@/types"

let chapterRequestId = 0
let searchRequestId = 0
let chaptersRequestId = 0

async function loadBooks() {
  if (!isTauriRuntime()) return []
  const books = await invokeTauri<EgwBook[]>("egw_list_books")
  useEgwStore.getState().setBooks(books)
  return books
}

async function loadChapters(bookNumber: number) {
  if (!isTauriRuntime()) return []
  const reqId = ++chaptersRequestId
  const chapters = await invokeTauri<EgwChapterInfo[]>("egw_list_chapters", {
    bookNumber,
  })
  if (reqId !== chaptersRequestId) return chapters
  useEgwStore.getState().setChapters(chapters)
  return chapters
}

async function loadChapter(bookNumber: number, chapter: number) {
  if (!isTauriRuntime()) return []
  const reqId = ++chapterRequestId
  const paragraphs = await invokeTauri<EgwParagraph[]>("egw_get_chapter", {
    bookNumber,
    chapter,
  })
  if (reqId !== chapterRequestId) return paragraphs
  useEgwStore.getState().setCurrentParagraphs(paragraphs)
  return paragraphs
}

async function search(query: string, limit = 20) {
  if (!isTauriRuntime()) return []
  const reqId = ++searchRequestId
  const results = await invokeTauri<EgwParagraph[]>("egw_search", {
    query,
    limit,
  })
  if (reqId !== searchRequestId) return results
  useEgwStore.getState().setSearchResults(results)
  return results
}

export const egwActions = {
  loadBooks,
  loadChapters,
  loadChapter,
  search,
}

export function useEgw() {
  const books = useEgwStore((s) => s.books)
  const selectedBookNumber = useEgwStore((s) => s.selectedBookNumber)
  const chapters = useEgwStore((s) => s.chapters)
  const selectedChapter = useEgwStore((s) => s.selectedChapter)
  const currentParagraphs = useEgwStore((s) => s.currentParagraphs)
  const searchResults = useEgwStore((s) => s.searchResults)
  const selectedParagraphId = useEgwStore((s) => s.selectedParagraphId)

  return {
    books,
    selectedBookNumber,
    chapters,
    selectedChapter,
    currentParagraphs,
    searchResults,
    selectedParagraphId,
    ...egwActions,
  }
}
