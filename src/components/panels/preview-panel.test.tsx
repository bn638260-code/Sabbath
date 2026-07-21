// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { fireEvent, waitFor } from "@testing-library/react"
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const fetchVerseMock = vi.fn()
const invokeTauriMock = vi.fn()
const selectVerseMock = vi.fn()
const navigateToVerseMock = vi.fn()
const setPreviewItemMock = vi.fn()
const setLiveItemMock = vi.fn()
const setLiveMock = vi.fn()
const presentationDeckControlsMock = vi.fn()

let activeTranslationId = 1
let previewItem: unknown = null
let selectedVerse: unknown = null
let currentChapter: unknown[] = []

const books = [
  {
    id: 43,
    translation_id: 1,
    book_number: 43,
    name: "John",
    abbreviation: "John",
    testament: "NT",
  },
]

const translations = [
  {
    id: 1,
    abbreviation: "KJV",
    title: "King James Version",
    language: "English",
    is_copyrighted: false,
    is_downloaded: true,
  },
  {
    id: 4,
    abbreviation: "Afr1953",
    title: "Afrikaans 1933/1953 Bybel",
    language: "af",
    is_copyrighted: true,
    is_downloaded: true,
  },
]

vi.mock("@/components/ui/canvas-verse", () => ({
  CanvasPresentation: () => React.createElement("div", { "data-testid": "canvas-presentation" }),
}))

vi.mock("@/components/panels/presentation-deck-controls", () => ({
  PresentationDeckControls: (props: Record<string, unknown>) => {
    presentationDeckControlsMock(props)
    return null
  },
}))

vi.mock("@/hooks/use-bible", () => ({
  bibleActions: {
    fetchVerse: (...args: unknown[]) => fetchVerseMock(...args),
    navigateToVerse: (...args: unknown[]) => navigateToVerseMock(...args),
    selectVerse: (...args: unknown[]) => selectVerseMock(...args),
  },
}))

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => invokeTauriMock(...args),
  isTauriRuntime: () => true,
  convertTauriFileSrc: (path: string) => path,
}))

vi.mock("@/stores/bible-store", () => {
  const useBibleStore = (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      activeTranslationId,
      books,
      currentChapter,
      selectedVerse,
      translations,
    })
  useBibleStore.getState = () => ({
    activeTranslationId,
    books,
    currentChapter,
    selectedVerse,
    selectVerse: selectVerseMock,
    translations,
  })
  return { useBibleStore }
})

vi.mock("@/stores/broadcast-store", () => {
  const useBroadcastStore = (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      previewItem,
      themes: [],
      activeThemeId: "",
      isLive: false,
      readingModeAutoLive: false,
    })
  const selectActiveTheme = (state: { themes: Array<{ id: string }>; activeThemeId: string }) =>
    state.themes.find((theme) => theme.id === state.activeThemeId) ?? state.themes[0] ?? null
  useBroadcastStore.getState = () => ({
    previewItem,
    setPreviewItem: setPreviewItemMock,
    setLiveItem: setLiveItemMock,
    setLive: setLiveMock,
  })
  return { selectActiveTheme, useBroadcastStore }
})

describe("PreviewPanel", () => {
  let PreviewPanel: typeof import("./preview-panel").PreviewPanel
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeAll(async () => {
    ;({ PreviewPanel } = await import("./preview-panel"))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    fetchVerseMock.mockResolvedValue(null)
    invokeTauriMock.mockImplementation(async (command: string) => {
      if (command === "egw_search") return []
      if (command === "search_verses") return []
      return null
    })
    activeTranslationId = 1
    previewItem = null
    selectedVerse = null
    currentChapter = []
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
    }
    container?.remove()
    root = null
    container = null
  })

  async function renderPanel() {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(React.createElement(PreviewPanel))
    })
  }

  it("does not replace a staged hymn preview when scripture translation changes", async () => {
    previewItem = {
      kind: "hymn",
      reference: "Hymn 12",
      segments: [{ text: "A hymn line" }],
    }
    selectedVerse = {
      book_number: 43,
      chapter: 3,
      verse: 16,
    }

    await renderPanel()

    expect(fetchVerseMock).not.toHaveBeenCalled()
    expect(setPreviewItemMock).not.toHaveBeenCalled()
  })

  it("quick-previews a complete Bible reference", async () => {
    const verse = {
      id: 316,
      translation_id: 1,
      book_number: 43,
      book_name: "John",
      book_abbreviation: "John",
      chapter: 3,
      verse: 16,
      text: "For God so loved the world.",
    }
    fetchVerseMock.mockResolvedValueOnce(verse)

    await renderPanel()

    const input = container?.querySelector<HTMLInputElement>(
      'input[placeholder^="Quick preview"]'
    )
    expect(input).not.toBeNull()

    await act(async () => {
      fireEvent.change(input!, { target: { value: "John 3:16" } })
    })

    await waitFor(() => {
      expect(fetchVerseMock).toHaveBeenCalledWith(43, 3, 16, 1)
    })
    expect(setPreviewItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "John 3:16 (KJV)",
      })
    )
  })

  it("quick-searches Afrikaans verse text and previews the first match", async () => {
    activeTranslationId = 4
    const verse = {
      id: 2027,
      translation_id: 4,
      book_number: 40,
      book_name: "Matteus",
      book_abbreviation: "Matt",
      chapter: 20,
      verse: 27,
      text: "En elkeen wat onder julle die eerste wil word, moet julle dienskneg wees;",
    }
    invokeTauriMock.mockImplementation(async (command: string) => {
      if (command === "search_verses") return [verse]
      if (command === "egw_search") return []
      return null
    })

    await renderPanel()

    const input = container?.querySelector<HTMLInputElement>(
      'input[placeholder^="Quick preview"]'
    )
    expect(input).not.toBeNull()

    await act(async () => {
      fireEvent.change(input!, { target: { value: "elkeen eerste" } })
    })

    await waitFor(() => {
      expect(invokeTauriMock).toHaveBeenCalledWith("search_verses", {
        query: "elkeen eerste",
        translationId: 4,
        limit: 5,
      })
    })

    await waitFor(() => {
      expect(container?.textContent).toContain("Matteus 20:27")
    })

    await act(async () => {
      fireEvent.keyDown(input!, { key: "Enter" })
    })

    expect(setPreviewItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "Matteus 20:27 (Afr1953)",
      })
    )
  })

  it("uses focused arrow keys to navigate the staged scripture preview", async () => {
    const verse16 = {
      id: 316,
      translation_id: 1,
      book_number: 43,
      book_name: "John",
      book_abbreviation: "John",
      chapter: 3,
      verse: 16,
      text: "For God so loved the world.",
    }
    const verse17 = {
      ...verse16,
      id: 317,
      verse: 17,
      text: "For God sent not his Son.",
    }
    currentChapter = [verse16, verse17]
    selectedVerse = verse16
    previewItem = {
      kind: "scripture",
      reference: "John 3:16 (KJV)",
      scripture: verse16,
      segments: [{ verseNumber: 16, text: verse16.text }],
    }

    await renderPanel()

    const panel = container?.querySelector<HTMLElement>(
      '[data-slot="preview-panel"]'
    )
    expect(panel).not.toBeNull()

    await act(async () => {
      fireEvent.keyDown(panel!, { key: "ArrowRight" })
    })

    expect(setPreviewItemMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "John 3:17 (KJV)",
      })
    )
    expect(navigateToVerseMock).toHaveBeenCalledWith(43, 3, 17)
  })

  it("pins deck navigation controls to preview mode", async () => {
    previewItem = {
      kind: "hymn",
      reference: "Hymn 12",
      segments: [{ text: "A hymn line" }],
    }

    await renderPanel()

    expect(presentationDeckControlsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        item: previewItem,
        crossQueueBoundaries: true,
        isLive: false,
        onNavigate: expect.any(Function),
      })
    )
  })
})
