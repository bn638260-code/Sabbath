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

  it("renders the unified themes catalog as a dedicated page", () => {
    const staticThemes = initialThemes.filter((theme) => !theme.kinetic)
    const kineticThemes = initialThemes.filter((theme) => theme.kinetic)
    expect(staticThemes.length).toBeGreaterThan(0)
    expect(kineticThemes.length).toBeGreaterThanOrEqual(14)

    render(<KineticThemesPage />)

    expect(screen.getByRole("heading", { name: "Themes" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Static" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Kinetic" })).toBeTruthy()
    expect(
      screen.getAllByText(`${staticThemes.length} static`).length
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(`${kineticThemes.length} kinetic`).length
    ).toBeGreaterThan(0)
    expect(screen.getAllByText(staticThemes[0].name).length).toBeGreaterThan(0)
    expect(screen.getAllByText(kineticThemes[0].name).length).toBeGreaterThan(0)
  })

  it("filters themes by name", () => {
    render(<KineticThemesPage />)

    fireEvent.change(screen.getByLabelText("Search themes"), {
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

  it("deletes custom kinetic themes from the catalog", () => {
    const kinetic = initialThemes.find((theme) => theme.kinetic)
    expect(kinetic).toBeTruthy()
    const customKinetic = {
      ...kinetic!,
      id: "custom-kinetic-theme",
      name: "Custom Kinetic Theme",
      builtin: false,
    }
    useBroadcastStore.setState({
      themes: [...initialThemes, customKinetic],
      activeThemeId: customKinetic.id,
      editingThemeId: customKinetic.id,
      draftTheme: customKinetic,
    })

    render(<KineticThemesPage />)

    expect(
      screen.queryByRole("button", { name: `Delete ${kinetic!.name}` })
    ).toBeNull()

    fireEvent.click(
      screen.getByRole("button", { name: `Delete ${customKinetic.name}` })
    )

    const state = useBroadcastStore.getState()
    expect(state.themes.some((theme) => theme.id === customKinetic.id)).toBe(
      false
    )
    expect(state.activeThemeId).not.toBe(customKinetic.id)
    expect(state.editingThemeId).not.toBe(customKinetic.id)
    expect(state.draftTheme?.id).not.toBe(customKinetic.id)
  })
})
