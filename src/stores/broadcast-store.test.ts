import { beforeEach, describe, expect, it, vi } from "vitest"

const emitToMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: emitToMock,
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    dismiss: vi.fn(),
  },
}))

describe("broadcast store sync", () => {
  beforeEach(async () => {
    emitToMock.mockReset()
    emitToMock.mockResolvedValue(undefined)
    toastErrorMock.mockReset()
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

  it("commits a live item and syncs both outputs once", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")
    const item = {
      reference: "Psalm 23:1",
      segments: [{ text: "The Lord is my shepherd", verseNumber: 1 }],
    }

    emitToMock.mockClear()
    useBroadcastStore.getState().commitLiveItem(item)

    expect(useBroadcastStore.getState()).toMatchObject({
      isLive: true,
      liveItem: item,
    })
    expect(emitToMock).toHaveBeenCalledTimes(2)
    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.objectContaining({ item }),
    )
    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast-alt",
      "broadcast:verse-update",
      expect.objectContaining({ item }),
    )
  })

  it("emits the selected transition when committing a live item", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")
    const theme = useBroadcastStore.getState().themes[0]
    const item = {
      reference: "Psalm 23:1",
      segments: [{ text: "The Lord is my shepherd", verseNumber: 1 }],
    }

    emitToMock.mockClear()
    useBroadcastStore.getState().setLiveTransitionType("slide")
    useBroadcastStore.getState().commitLiveItem(item)

    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.objectContaining({
        transition: expect.objectContaining({
          type: "slide",
          duration: theme.transition.duration,
          easing: theme.transition.easing,
          direction: theme.transition.direction,
        }),
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

  it("reports a broadcast sync issue when emitTo rejects", async () => {
    emitToMock.mockRejectedValueOnce(new Error("webview missing"))
    const { useBroadcastStore } = await import("./broadcast-store")

    useBroadcastStore.getState().syncBroadcastOutputFor("main")

    await Promise.resolve()

    const issue = useBroadcastStore
      .getState()
      .outputIssues.find((entry) => entry.kind === "broadcast-sync")
    expect(issue).toMatchObject({
      outputId: "main",
      kind: "broadcast-sync",
      count: 1,
    })
    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:verse-update",
      expect.any(Object),
    )
  })

  it("does not clear preview-open issues after a successful broadcast sync", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")

    useBroadcastStore.getState().reportOutputIssue({
      outputId: "main",
      kind: "preview-open",
      title: "Broadcast preview did not open",
      description: "The open command completed, but the preview window was not found.",
    })

    emitToMock.mockResolvedValueOnce(undefined)
    useBroadcastStore.getState().syncBroadcastOutputFor("main")
    await Promise.resolve()

    expect(useBroadcastStore.getState().outputIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "main:preview-open",
        }),
      ]),
    )
  })

  it("clears broadcast sync issues after the next successful sync", async () => {
    emitToMock.mockRejectedValueOnce(new Error("webview missing"))
    const { useBroadcastStore } = await import("./broadcast-store")

    useBroadcastStore.getState().syncBroadcastOutputFor("main")
    await Promise.resolve()
    expect(useBroadcastStore.getState().outputIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "main:broadcast-sync",
        }),
      ]),
    )

    emitToMock.mockResolvedValueOnce(undefined)
    useBroadcastStore.getState().syncBroadcastOutputFor("main")
    await Promise.resolve()

    expect(useBroadcastStore.getState().outputIssues).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "main:broadcast-sync",
        }),
      ]),
    )
  })

  it("dedupes repeated output issues and increments count", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")
    const report = useBroadcastStore.getState().reportOutputIssue

    report({
      outputId: "main",
      kind: "ndi-frame",
      title: "NDI frame push failed",
      description: "first",
    })
    report({
      outputId: "main",
      kind: "ndi-frame",
      title: "NDI frame push failed",
      description: "second",
    })

    const issues = useBroadcastStore.getState().outputIssues
    expect(issues).toHaveLength(1)
    expect(issues[0].count).toBe(2)
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    expect(toastErrorMock.mock.calls[0][1]).toMatchObject({ id: "main:ndi-frame" })
  })

  it("caps output issues and drops stale entries", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-09T10:00:00Z"))
    const { useBroadcastStore } = await import("./broadcast-store")
    const report = useBroadcastStore.getState().reportOutputIssue

    for (let i = 0; i < 20; i += 1) {
      report({
        id: `old-${i}`,
        outputId: "global",
        kind: "persistence",
        title: "Old issue",
        description: "old",
      })
    }
    expect(useBroadcastStore.getState().outputIssues).toHaveLength(20)

    vi.setSystemTime(new Date("2026-06-09T10:11:00Z"))
    report({
      id: "fresh",
      outputId: "main",
      kind: "ndi-config",
      title: "Fresh issue",
      description: "fresh",
    })

    expect(useBroadcastStore.getState().outputIssues).toEqual([
      expect.objectContaining({ id: "fresh" }),
    ])
    vi.useRealTimers()
  })

  it("dismisses a typed output issue after targeted recovery", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")
    useBroadcastStore.getState().reportOutputIssue({
      outputId: "main",
      kind: "ndi-config",
      title: "NDI config sync failed",
      description: "missing",
    })

    useBroadcastStore.getState().clearOutputIssueFor("main", "ndi-config")

    expect(useBroadcastStore.getState().outputIssues).toHaveLength(0)
  })

  it("clears a single output issue by id", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")
    useBroadcastStore.getState().reportOutputIssue({
      outputId: "global",
      kind: "persistence",
      title: "Save failed",
      description: "disk error",
    })

    const issueId = useBroadcastStore.getState().outputIssues[0].id
    useBroadcastStore.getState().clearOutputIssue(issueId)

    expect(useBroadcastStore.getState().outputIssues).toHaveLength(0)
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

  it("decides video end behavior in loop advance hold order", async () => {
    const { decideVideoEndAction } = await import("./broadcast-store")

    expect(
      decideVideoEndAction({
        loop: true,
        autoAdvance: true,
        hasNextItem: true,
      }),
    ).toBe("loop")
    expect(
      decideVideoEndAction({
        loop: false,
        autoAdvance: true,
        hasNextItem: true,
      }),
    ).toBe("advance")
    expect(
      decideVideoEndAction({
        loop: false,
        autoAdvance: true,
        hasNextItem: false,
      }),
    ).toBe("hold")
  })

  it("emits video load commands when a video item goes live", async () => {
    const { useBroadcastStore } = await import("./broadcast-store")
    const item = {
      kind: "video" as const,
      reference: "Welcome Video",
      segments: [{ text: "Welcome Video" }],
      video: {
        source: "url" as const,
        videoId: "video-1",
        title: "Welcome Video",
        url: "https://cdn.example.com/welcome.mp4",
      },
    }

    emitToMock.mockClear()
    useBroadcastStore.getState().commitLiveItem(item)

    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast",
      "broadcast:video-control",
      {
        type: "load",
        item,
      },
    )
    expect(emitToMock).toHaveBeenCalledWith(
      "broadcast-alt",
      "broadcast:video-control",
      {
        type: "load",
        item,
      },
    )
  })
})
