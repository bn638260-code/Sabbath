// @vitest-environment jsdom
import React from "react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { KineticThemesPage } from "./KineticThemesPage"
import type { BroadcastTheme } from "@/types"

const emitToMock = vi.hoisted(() => vi.fn())

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: emitToMock,
}))

vi.mock("@/components/ui/canvas-verse", () => ({
  CanvasVerse: ({ theme }: { theme: BroadcastTheme }) =>
    React.createElement(
      "div",
      { "data-testid": "kinetic-preview" },
      theme.name
    ),
}))

vi.mock("@/components/broadcast/theme-designer", () => ({
  ThemeDesigner: () =>
    React.createElement("div", { "data-testid": "theme-designer" }),
}))

describe("KineticThemesPage", () => {
  let useBroadcastStore: typeof import("@/stores/broadcast-store").useBroadcastStore
  let initialThemes: ReturnType<typeof useBroadcastStore.getState>["themes"]

  beforeAll(async () => {
    ;({ useBroadcastStore } = await import("@/stores/broadcast-store"))
    initialThemes = [...useBroadcastStore.getState().themes]
  })

  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    emitToMock.mockResolvedValue(undefined)
    useBroadcastStore.setState({
      themes: [...initialThemes],
      activeThemeId: initialThemes[0].id,
      editingThemeId: null,
      draftTheme: null,
      isDesignerOpen: false,
    })
  })

  it("renders the kinetic catalog as a dedicated page", () => {
    const kineticThemes = initialThemes.filter((theme) => theme.kinetic)
    expect(kineticThemes.length).toBeGreaterThanOrEqual(14)

    render(<KineticThemesPage />)

    expect(screen.getByRole("heading", { name: "Kinetic Themes" })).toBeTruthy()
    expect(screen.getByText(`${kineticThemes.length} presets`)).toBeTruthy()
    expect(screen.getAllByText(kineticThemes[0].name).length).toBeGreaterThan(0)
  })

  it("filters kinetic themes by name", () => {
    render(<KineticThemesPage />)

    fireEvent.change(screen.getByLabelText("Search kinetic themes"), {
      target: { value: "Emerald" },
    })

    expect(
      screen.getByRole("button", { name: "Apply Neon Emerald (Kinetic)" })
    ).toBeTruthy()
    expect(
      screen.queryByRole("button", { name: "Apply Midnight Ocean (Kinetic)" })
    ).toBeNull()
  })

  it("applies a kinetic theme to the broadcast output", () => {
    const kinetic = initialThemes.find(
      (theme) => theme.name === "Neon Emerald (Kinetic)"
    )
    expect(kinetic).toBeTruthy()

    render(<KineticThemesPage />)
    fireEvent.click(
      screen.getByRole("button", { name: `Apply ${kinetic!.name}` })
    )

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

  it("opens the designer on the selected kinetic preset", () => {
    const kinetic = initialThemes.find((theme) => theme.kinetic)
    expect(kinetic).toBeTruthy()

    render(<KineticThemesPage />)
    fireEvent.click(
      screen.getByRole("button", { name: `Edit ${kinetic!.name}` })
    )

    expect(useBroadcastStore.getState().isDesignerOpen).toBe(true)
    expect(useBroadcastStore.getState().editingThemeId).toBe(kinetic!.id)
  })
})
