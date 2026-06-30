// @vitest-environment jsdom
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const emitToMock = vi.fn()

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: emitToMock,
}))

vi.mock("@/components/ui/canvas-verse", () => ({
  CanvasVerse: ({ theme }: { theme: { name: string } }) =>
    React.createElement(
      "div",
      { "data-testid": "theme-thumbnail" },
      theme.name
    ),
}))

vi.mock("@/lib/theme-designer-files", () => ({
  importTheme: vi.fn(),
  exportTheme: vi.fn(),
}))

describe("ThemeLibrary", () => {
  let ThemeLibrary: typeof import("./theme-library").ThemeLibrary
  let useBroadcastStore: typeof import("@/stores/broadcast-store").useBroadcastStore
  let initialThemes: ReturnType<typeof useBroadcastStore.getState>["themes"]
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeAll(async () => {
    ;({ useBroadcastStore } = await import("@/stores/broadcast-store"))
    initialThemes = [...useBroadcastStore.getState().themes]
    ;({ ThemeLibrary } = await import("./theme-library"))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    emitToMock.mockResolvedValue(undefined)
    useBroadcastStore.setState({
      themes: [...initialThemes],
      activeThemeId: initialThemes[0].id,
      editingThemeId: null,
      draftTheme: null,
      renamingThemeId: null,
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

  async function renderLibrary() {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(React.createElement(ThemeLibrary))
    })
  }

  function getThemeCard(themeName: string): HTMLDivElement {
    const card = Array.from(
      container?.querySelectorAll<HTMLDivElement>('[role="button"]') ?? []
    ).find((element) => element.textContent?.includes(themeName))

    expect(card).toBeTruthy()
    return card as HTMLDivElement
  }

  it("activates the theme when a theme card is selected", async () => {
    const nextTheme = initialThemes[1]

    await renderLibrary()

    await act(async () => {
      getThemeCard(nextTheme.name).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      )
    })

    expect(useBroadcastStore.getState().activeThemeId).toBe(nextTheme.id)
    expect(useBroadcastStore.getState().editingThemeId).toBe(nextTheme.id)
    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.objectContaining({
        theme: expect.objectContaining({ id: nextTheme.id }),
      })
    )
  })

  it("selecting a kinetic preset activates it and emits kinetic metadata", async () => {
    const kinetic = initialThemes.find((t) => t.kinetic)
    expect(kinetic).toBeTruthy()

    await renderLibrary()

    await act(async () => {
      getThemeCard(kinetic!.name).dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      )
    })

    expect(useBroadcastStore.getState().activeThemeId).toBe(kinetic!.id)
    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.objectContaining({
        theme: expect.objectContaining({
          id: kinetic!.id,
          kinetic: expect.objectContaining({ source: "html-prototype-v2" }),
        }),
      })
    )
  })

  it("renders a dedicated kinetic section with the kinetic filter tab", async () => {
    const kineticThemes = initialThemes.filter((t) => t.kinetic)
    expect(kineticThemes.length).toBeGreaterThanOrEqual(14)

    await renderLibrary()

    // The kinetic filter tab exists as its own selection workflow.
    const kineticTab = Array.from(
      container?.querySelectorAll("button") ?? []
    ).find((b) => b.textContent?.trim().toLowerCase() === "kinetic")
    expect(kineticTab).toBeTruthy()

    // A dedicated "Kinetic Motion" section header is present.
    const headers = Array.from(container?.querySelectorAll("p") ?? []).map(
      (p) => p.textContent ?? ""
    )
    expect(headers.some((t) => t.includes("Kinetic Motion"))).toBe(true)

    // Every kinetic preset renders as a card.
    const texts = Array.from(
      container?.querySelectorAll<HTMLDivElement>('[role="button"]') ?? []
    ).map((c) => c.textContent ?? "")
    for (const theme of kineticThemes) {
      expect(texts.some((t) => t.includes(theme.name))).toBe(true)
    }
  })

  it("shows kinetic presets before the long built-in theme list", async () => {
    await renderLibrary()

    const headings = Array.from(container?.querySelectorAll("p") ?? []).map(
      (p) => p.textContent ?? ""
    )
    const kineticIndex = headings.findIndex((text) =>
      text.includes("Kinetic Motion")
    )
    const builtInIndex = headings.findIndex((text) => text.includes("Built-in"))

    expect(kineticIndex).toBeGreaterThanOrEqual(0)
    expect(builtInIndex).toBeGreaterThanOrEqual(0)
    expect(kineticIndex).toBeLessThan(builtInIndex)
  })

  it("renders custom kinetic themes only once in the kinetic section", async () => {
    const kinetic = initialThemes.find((t) => t.kinetic)
    expect(kinetic).toBeTruthy()
    const customKinetic = {
      ...kinetic!,
      id: "custom-kinetic-theme",
      name: "Custom Kinetic Theme",
      builtin: false,
    }
    useBroadcastStore.setState({
      themes: [...initialThemes, customKinetic],
    })

    await renderLibrary()

    const matchingCards = Array.from(
      container?.querySelectorAll<HTMLDivElement>('[role="button"]') ?? []
    ).filter((card) => card.textContent?.includes(customKinetic.name))
    expect(matchingCards).toHaveLength(1)
  })
})
