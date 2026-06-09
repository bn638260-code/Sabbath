import { describe, expect, it, vi } from "vitest"
import { handleQuickSearchKeyDown } from "./use-quick-verse-search"

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
