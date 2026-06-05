import { beforeEach, describe, expect, it, vi } from "vitest"

const emitToMock = vi.fn()

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: emitToMock,
}))

describe("broadcast store sync", () => {
  beforeEach(async () => {
    emitToMock.mockReset()
    emitToMock.mockResolvedValue(undefined)
    vi.resetModules()
  })

  it("syncBroadcastOutput emits current theme and item to broadcast window", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")
    const theme = useBroadcastStore.getState().themes[0]
    useBroadcastStore.setState({
      activeThemeId: theme.id,
      isLive: true,
      liveItem: {
        reference: "John 3:16",
        segments: [{ text: "For God so loved the world", verseNumber: 16 }],
      },
    })

    emitToMock.mockClear()
    useBroadcastStore.getState().syncBroadcastOutput()

    expect(emitToMock).toHaveBeenCalledTimes(2)
    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.objectContaining({
        theme: expect.objectContaining({ id: theme.id }),
        item: expect.objectContaining({ reference: "John 3:16" }),
      }),
    )
    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast-alt",
      "broadcast:verse-update",
      expect.objectContaining({
        theme: expect.objectContaining({ id: theme.id }),
        item: expect.objectContaining({ reference: "John 3:16" }),
      }),
    )
  })

  it("emits a blank item when live output is off", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")
    const theme = useBroadcastStore.getState().themes[0]
    useBroadcastStore.setState({
      activeThemeId: theme.id,
      isLive: false,
      liveItem: {
        reference: "John 3:16",
        segments: [{ text: "For God so loved the world", verseNumber: 16 }],
      },
    })

    emitToMock.mockClear()
    useBroadcastStore.getState().syncBroadcastOutputFor("main")

    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.objectContaining({
        item: null,
      }),
    )
  })

  it("syncs the broadcast output when live mode changes", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")
    const theme = useBroadcastStore.getState().themes[0]
    useBroadcastStore.setState({
      activeThemeId: theme.id,
      isLive: false,
      liveItem: {
        reference: "John 3:16",
        segments: [{ text: "For God so loved the world", verseNumber: 16 }],
      },
    })

    emitToMock.mockClear()
    useBroadcastStore.getState().setLive(true)

    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.objectContaining({
        item: expect.objectContaining({ reference: "John 3:16" }),
      }),
    )

    emitToMock.mockClear()
    useBroadcastStore.getState().setLive(false)

    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.objectContaining({
        item: null,
      }),
    )
  })

  it("stores the reading mode auto-live preference without emitting output", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")

    emitToMock.mockClear()
    useBroadcastStore.getState().setReadingModeAutoLive(false)

    expect(useBroadcastStore.getState().readingModeAutoLive).toBe(false)
    expect(emitToMock).not.toHaveBeenCalled()
  })

  it("stores the main display monitor index without emitting output", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")

    emitToMock.mockClear()
    useBroadcastStore.getState().setMainDisplayMonitorIndex(2)

    expect(useBroadcastStore.getState().mainDisplayMonitorIndex).toBe(2)
    expect(emitToMock).not.toHaveBeenCalled()
  })

  it("stores the alt display monitor index without emitting output", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")

    emitToMock.mockClear()
    useBroadcastStore.getState().setAltDisplayMonitorIndex(1)

    expect(useBroadcastStore.getState().altDisplayMonitorIndex).toBe(1)
    expect(emitToMock).not.toHaveBeenCalled()
  })

  it("stores the main projector fullscreen preference without emitting output", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")

    emitToMock.mockClear()
    useBroadcastStore.getState().setMainProjectorFullscreen(true)

    expect(useBroadcastStore.getState().mainProjectorFullscreen).toBe(true)
    expect(emitToMock).not.toHaveBeenCalled()
  })

  it("stores the alt projector fullscreen preference without emitting output", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")

    emitToMock.mockClear()
    useBroadcastStore.getState().setAltProjectorFullscreen(true)

    expect(useBroadcastStore.getState().altProjectorFullscreen).toBe(true)
    expect(emitToMock).not.toHaveBeenCalled()
  })

  it("falls back to a builtin theme when deleting active custom themes", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")
    const builtin = useBroadcastStore.getState().themes[0]
    const custom = {
      ...builtin,
      id: "custom-theme",
      name: "Custom",
      builtin: false,
    }
    useBroadcastStore.setState({
      themes: [builtin, custom],
      activeThemeId: custom.id,
      altActiveThemeId: custom.id,
    })

    useBroadcastStore.getState().deleteTheme(custom.id)

    expect(useBroadcastStore.getState()).toMatchObject({
      themes: [builtin],
      activeThemeId: builtin.id,
      altActiveThemeId: builtin.id,
    })
  })

  it("hydrates an explicit empty custom theme list as builtin-only themes", async () => {
    const { buildBroadcastHydrationPatch } = await import("./broadcast-store")

    const patch = buildBroadcastHydrationPatch({ customThemes: [] })

    expect(patch.themes).toBeDefined()
    expect(patch.themes?.every((theme) => theme.builtin)).toBe(true)
  })

  it("does not switch the active theme when saving a builtin as a custom copy", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")
    const builtin = useBroadcastStore.getState().themes[0]
    useBroadcastStore.setState({
      activeThemeId: builtin.id,
      editingThemeId: builtin.id,
      draftTheme: { ...builtin, name: "Edited Builtin" },
    })

    useBroadcastStore.getState().saveDraft()

    const state = useBroadcastStore.getState()
    expect(state.activeThemeId).toBe(builtin.id)
    expect(state.editingThemeId).not.toBe(builtin.id)
    expect(state.draftTheme?.builtin).toBe(false)
    expect(state.themes.some((theme) => !theme.builtin && theme.name === "Edited Builtin (Custom)")).toBe(true)
  })

  it("clamps opacity and syncs the projector output", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")

    emitToMock.mockClear()
    useBroadcastStore.getState().setOpacity(2)

    expect(useBroadcastStore.getState().opacity).toBe(1)
    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.objectContaining({ opacity: 1 }),
    )
  })
})
