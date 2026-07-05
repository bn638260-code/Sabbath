// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { handleQuickSearchKeyDown, useQuickVerseSearch } from "./use-quick-verse-search"
import type { Verse } from "@/types"

describe("handleQuickSearchKeyDown", () => {
  it("accepts the autocomplete suggestion on Tab", () => {
    const setQuickInput = vi.fn()
    const clearQuickSearch = vi.fn()

    handleQuickSearchKeyDown(
      {
        key: "Tab",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLInputElement>,
      {
        quickInput: "J",
        quickSuggestion: "John 1:1",
        setQuickInput,
        clearQuickSearch,
      },
    )

    expect(setQuickInput).toHaveBeenCalledWith("John ")
  })

  it("clears quick search on Enter", () => {
    const setQuickInput = vi.fn()
    const clearQuickSearch = vi.fn()

    handleQuickSearchKeyDown(
      {
        key: "Enter",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLInputElement>,
      {
        quickInput: "John 3:16",
        quickSuggestion: "",
        setQuickInput,
        clearQuickSearch,
      },
    )

    expect(clearQuickSearch).toHaveBeenCalled()
  })

  it("clears quick search on Escape", () => {
    const setQuickInput = vi.fn()
    const clearQuickSearch = vi.fn()

    handleQuickSearchKeyDown(
      {
        key: "Escape",
        preventDefault: vi.fn(),
      } as unknown as React.KeyboardEvent<HTMLInputElement>,
      {
        quickInput: "John 3",
        quickSuggestion: "John 3:1",
        setQuickInput,
        clearQuickSearch,
      },
    )

    expect(clearQuickSearch).toHaveBeenCalled()
  })
})

describe("useQuickVerseSearch", () => {
  it("notifies onVerseSelected when a dropdown verse is clicked", () => {
    const onVerseSelected = vi.fn()
    const { result } = renderHook(() =>
      useQuickVerseSearch({ books: [], activeTranslationId: 1, onVerseSelected }),
    )

    const verse: Verse = {
      id: 42,
      translation_id: 1,
      book_number: 43,
      book_name: "John",
      book_abbreviation: "Jhn",
      chapter: 3,
      verse: 16,
      text: "For God so loved the world...",
    }

    act(() => {
      result.current.handleQuickVerseClick(verse)
    })

    expect(onVerseSelected).toHaveBeenCalledWith(verse)
  })
})
