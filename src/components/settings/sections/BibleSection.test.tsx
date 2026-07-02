// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { fireEvent, waitFor } from "@testing-library/react"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const invokeTauriMock = vi.fn()
const setActiveTranslationMock = vi.fn()
const refreshLiveTranslationMock = vi.fn()

const translations = [
  {
    id: 1,
    abbreviation: "KJV",
    title: "King James Version",
    language: "en",
    is_copyrighted: false,
    is_downloaded: true,
  },
  {
    id: 2,
    abbreviation: "NIV",
    title: "New International Version",
    language: "en",
    is_copyrighted: false,
    is_downloaded: true,
  },
]

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => invokeTauriMock(...args),
}))

vi.mock("@/stores/bible-store", () => ({
  useBibleStore: {
    getState: () => ({ setActiveTranslation: setActiveTranslationMock }),
  },
}))

vi.mock("@/lib/presentation-workflow", () => ({
  refreshLiveTranslation: (...args: unknown[]) => refreshLiveTranslationMock(...args),
}))

// Reduce the Radix Select to a native <select> so the change is drivable in jsdom.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value: string
    onValueChange: (value: string) => void
    disabled?: boolean
    children: React.ReactNode
  }) =>
    React.createElement(
      "select",
      {
        "data-testid": "translation-select",
        value,
        disabled,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
          onValueChange(e.target.value),
      },
      children
    ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => children,
  SelectItem: ({
    value,
    disabled,
    children,
  }: {
    value: string
    disabled?: boolean
    children: React.ReactNode
  }) => React.createElement("option", { value, disabled }, children),
}))

describe("BibleSection", () => {
  let BibleSection: typeof import("./BibleSection").BibleSection
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeAll(async () => {
    ;({ BibleSection } = await import("./BibleSection"))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    invokeTauriMock.mockImplementation(async (command: string) => {
      if (command === "list_translations") return translations
      if (command === "get_active_translation") return 1
      return undefined
    })
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

  async function renderSection() {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(React.createElement(BibleSection))
    })
  }

  it("refreshes the live verse after switching the primary translation", async () => {
    await renderSection()
    await waitFor(() =>
      expect(invokeTauriMock).toHaveBeenCalledWith("get_active_translation")
    )

    const select = container?.querySelector(
      "[data-testid='translation-select']"
    ) as HTMLSelectElement
    await act(async () => {
      fireEvent.change(select, { target: { value: "2" } })
    })

    await waitFor(() =>
      expect(invokeTauriMock).toHaveBeenCalledWith("set_active_translation", {
        translationId: 2,
      })
    )
    expect(setActiveTranslationMock).toHaveBeenCalledWith(2)
    expect(refreshLiveTranslationMock).toHaveBeenCalledTimes(1)
  })

  it("does not refresh the live verse when the backend switch fails", async () => {
    await renderSection()
    await waitFor(() =>
      expect(invokeTauriMock).toHaveBeenCalledWith("get_active_translation")
    )

    invokeTauriMock.mockRejectedValueOnce(new Error("backend down"))
    const select = container?.querySelector(
      "[data-testid='translation-select']"
    ) as HTMLSelectElement
    await act(async () => {
      fireEvent.change(select, { target: { value: "2" } })
    })

    await waitFor(() =>
      expect(invokeTauriMock).toHaveBeenCalledWith("set_active_translation", {
        translationId: 2,
      })
    )
    expect(setActiveTranslationMock).not.toHaveBeenCalled()
    expect(refreshLiveTranslationMock).not.toHaveBeenCalled()
  })

  it("marks locked translations as coming soon", async () => {
    invokeTauriMock.mockImplementation(async (command: string) => {
      if (command === "list_translations") {
        return translations.map((translation) =>
          translation.abbreviation === "NIV"
            ? { ...translation, is_copyrighted: true }
            : translation
        )
      }
      if (command === "get_active_translation") return 1
      return undefined
    })

    await renderSection()
    await waitFor(() =>
      expect(container?.textContent).toContain("NIV")
    )

    expect(container?.textContent).toContain("Coming soon")
    const nivOption = Array.from(
      container?.querySelectorAll("option") ?? []
    ).find((option) => option.value === "2")
    expect(nivOption?.disabled).toBe(true)
  })
})
