// @vitest-environment jsdom
import { act } from "react"
import { renderHook, waitFor, type RenderHookResult } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { BroadcastOutputCommandState } from "./use-broadcast-output-settings"

const mockInvoke = vi.fn()
const mockEmitTo = vi.fn()
const mockGetAllWindows = vi.fn()
const mockSyncBroadcastOutputFor = vi.fn()
const mockToastError = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: (...args: unknown[]) => mockEmitTo(...args),
}))

vi.mock("@tauri-apps/api/window", () => ({
  getAllWindows: () => mockGetAllWindows(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

const sampleMonitors = [
  {
    name: "HDMI-1",
    width: 1920,
    height: 1080,
    x: 0,
    y: 0,
    key: "hdmi-1|1920x1080|0,0",
  },
  {
    name: "HDMI-2",
    width: 1280,
    height: 720,
    x: 1920,
    y: 0,
    key: "hdmi-2|1280x720|1920,0",
  },
]

function baseState(
  overrides: Partial<BroadcastOutputCommandState> = {},
): BroadcastOutputCommandState {
  return {
    outputId: "main",
    isPreviewOpen: false,
    selectedMonitor: sampleMonitors[1].key,
    monitors: sampleMonitors,
    fallbackMonitorIndex: 0,
    projectorFullscreen: false,
    ndiActive: false,
    ndiSourceName: "SabbathCue Output",
    ndiResolution: "r1080p",
    ndiFrameRate: "fps24",
    ndiAlphaMode: "straightAlpha",
    ndiSdkInstalled: true,
    ...overrides,
  }
}

function baseDeps() {
  return {
    invoke: mockInvoke,
    syncBroadcastOutputFor: mockSyncBroadcastOutputFor,
    emitNdiConfig: vi.fn(),
    onPreviewOpenChange: vi.fn(),
    onNdiActiveChange: vi.fn(),
    onError: vi.fn(),
    onIssue: vi.fn(),
    clearOutputIssueFor: vi.fn(),
  }
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

async function loadCommandModule() {
  vi.resetModules()
  return import("./use-broadcast-output-settings")
}

describe("use-broadcast-output-settings commands", () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    mockInvoke.mockReset()
    mockEmitTo.mockReset()
    mockGetAllWindows.mockReset()
    mockSyncBroadcastOutputFor.mockReset()
    mockToastError.mockReset()
    mockGetAllWindows.mockResolvedValue([])
    mockEmitTo.mockResolvedValue(undefined)
  })

  describe("runToggleBroadcastPreview", () => {
    it("opens preview with monitor args then syncs output", async () => {
      mockInvoke.mockResolvedValue(undefined)
      mockGetAllWindows.mockResolvedValue([{ label: "broadcast" }])

      const { runToggleBroadcastPreview } = await loadCommandModule()
      const deps = baseDeps()

      await runToggleBroadcastPreview(
        baseState({
          projectorFullscreen: true,
          selectedMonitor: sampleMonitors[1].key,
        }),
        deps,
      )

      expect(mockInvoke).toHaveBeenCalledWith("open_broadcast_window", {
        outputId: "main",
        monitorIndex: 1,
        monitorKey: sampleMonitors[1].key,
        fullscreen: true,
      })
      expect(deps.onPreviewOpenChange).toHaveBeenCalledWith(true)
      expect(deps.clearOutputIssueFor).toHaveBeenCalledWith("main", "preview-open")
      expect(mockSyncBroadcastOutputFor).toHaveBeenCalledWith("main")
      expect(deps.emitNdiConfig).toHaveBeenCalledWith(false, "fps24", "r1080p")
    })

    it("closes preview before reconciling window state", async () => {
      mockInvoke.mockResolvedValue(undefined)
      mockGetAllWindows.mockResolvedValue([])

      const { runToggleBroadcastPreview } = await loadCommandModule()
      const deps = baseDeps()

      await runToggleBroadcastPreview(baseState({ isPreviewOpen: true }), deps)

      expect(mockInvoke).toHaveBeenCalledWith("close_broadcast_window", {
        outputId: "main",
      })
      expect(deps.onPreviewOpenChange).toHaveBeenCalledWith(false)
    })

    it("reports when the preview command succeeds but no window appears", async () => {
      vi.useFakeTimers()
      mockInvoke.mockResolvedValue(undefined)
      mockGetAllWindows.mockResolvedValue([])

      const { runToggleBroadcastPreview } = await loadCommandModule()
      const deps = baseDeps()

      const pending = runToggleBroadcastPreview(baseState(), deps)
      await vi.advanceTimersByTimeAsync(60_000)
      await pending

      expect(deps.onPreviewOpenChange).toHaveBeenCalledWith(false)
      expect(deps.onIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          outputId: "main",
          kind: "preview-open",
          title: "Broadcast preview did not open",
        }),
      )
      expect(deps.onError).toHaveBeenCalledWith(
        "Broadcast preview did not open",
        "The open command completed, but the preview window was not found.",
      )
      expect(mockSyncBroadcastOutputFor).not.toHaveBeenCalled()
    })

    it("registers a projector window that takes seconds to appear", async () => {
      // Regression: the open path used to give up after ~1s, while WebView2
      // window creation on a freshly connected HDMI display can take several
      // seconds — the connection opened but never "registered" in the UI.
      vi.useFakeTimers()
      mockInvoke.mockResolvedValue(undefined)
      let windowChecks = 0
      mockGetAllWindows.mockImplementation(() => {
        windowChecks += 1
        // The window only becomes visible ~3.5s into the wait.
        return Promise.resolve(windowChecks >= 15 ? [{ label: "broadcast" }] : [])
      })

      const { runToggleBroadcastPreview } = await loadCommandModule()
      const deps = baseDeps()

      const pending = runToggleBroadcastPreview(baseState(), deps)
      await vi.advanceTimersByTimeAsync(60_000)
      await pending

      expect(deps.onPreviewOpenChange).toHaveBeenCalledWith(true)
      expect(deps.onIssue).not.toHaveBeenCalled()
      expect(deps.onError).not.toHaveBeenCalled()
    })

    it("waits at least five seconds on the open path before giving up", async () => {
      vi.useFakeTimers()
      mockGetAllWindows.mockResolvedValue([])

      const { reconcileBroadcastPreviewState, OPEN_PREVIEW_RECONCILE_OPTIONS } =
        await loadCommandModule()

      const startedAt = Date.now()
      const pending = reconcileBroadcastPreviewState(
        "main",
        OPEN_PREVIEW_RECONCILE_OPTIONS,
      )
      await vi.advanceTimersByTimeAsync(60_000)
      expect(await pending).toBe(false)
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(5000)
    })
  })

  describe("runToggleBroadcastNdi", () => {
    it("blocks inactive NDI starts as coming soon", async () => {
      const { runToggleBroadcastNdi } = await loadCommandModule()
      const deps = baseDeps()

      await runToggleBroadcastNdi(baseState(), deps)

      expect(mockInvoke).not.toHaveBeenCalled()
      expect(deps.onError).toHaveBeenCalledWith(
        "NDI output is coming soon.",
        "Use External Display over HDMI while NDI is being verified.",
      )
    })

    it("stops NDI and closes the window when preview is not open", async () => {
      mockInvoke.mockResolvedValue(undefined)

      const { runToggleBroadcastNdi } = await loadCommandModule()
      const deps = baseDeps()

      await runToggleBroadcastNdi(baseState({ ndiActive: true }), deps)

      expect(mockInvoke.mock.calls.map((call) => call[0])).toEqual([
        "stop_ndi",
        "close_broadcast_window",
      ])
      expect(deps.emitNdiConfig).toHaveBeenCalledWith(false, "fps24", "r1080p")
      expect(deps.onNdiActiveChange).toHaveBeenCalledWith(false)
    })

    it("blocks inactive NDI starts even when the SDK is missing", async () => {
      const { runToggleBroadcastNdi } = await loadCommandModule()
      const deps = baseDeps()

      await runToggleBroadcastNdi(baseState({ ndiSdkInstalled: false }), deps)

      expect(mockInvoke).not.toHaveBeenCalled()
      expect(deps.onError).toHaveBeenCalledWith(
        "NDI output is coming soon.",
        "Use External Display over HDMI while NDI is being verified.",
      )
    })
  })

  describe("runDisableBroadcastOutput", () => {
    it("stops preview and NDI in order when disabling output", async () => {
      mockInvoke.mockResolvedValue(undefined)

      const { runDisableBroadcastOutput } = await loadCommandModule()
      const deps = baseDeps()

      await runDisableBroadcastOutput(
        {
          outputId: "alt",
          isPreviewOpen: true,
          ndiActive: true,
          ndiFrameRate: "fps30",
          ndiResolution: "r720p",
        },
        deps,
      )

      expect(mockInvoke.mock.calls.map((call) => call[0])).toEqual([
        "get_ndi_status",
        "close_broadcast_window",
        "stop_ndi",
        "get_ndi_status",
      ])
      expect(deps.onPreviewOpenChange).toHaveBeenCalledWith(false)
      expect(deps.emitNdiConfig).toHaveBeenCalledWith(false, "fps30", "r720p")
      expect(deps.onNdiActiveChange).toHaveBeenCalledWith(false)
    })

    it("reconciles preview and NDI state before reporting disabled", async () => {
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "get_ndi_status")
          return { active: true, width: 1920, height: 1080, fps: 24 }
        return undefined
      })
      mockGetAllWindows.mockResolvedValue([])

      const { runDisableBroadcastOutput } = await loadCommandModule()
      const onPreviewOpenChange = vi.fn()
      const onNdiActiveChange = vi.fn()

      await runDisableBroadcastOutput(
        {
          outputId: "main",
          isPreviewOpen: true,
          ndiActive: true,
          ndiFrameRate: "fps24",
          ndiResolution: "r1080p",
        },
        {
          ...baseDeps(),
          onPreviewOpenChange,
          onNdiActiveChange,
        },
      )

      expect(onPreviewOpenChange).toHaveBeenCalledWith(false)
      expect(onNdiActiveChange).toHaveBeenCalledWith(true)
    })

    it("closes a preview discovered during disable reconciliation", async () => {
      mockInvoke.mockResolvedValue(undefined)
      mockGetAllWindows.mockResolvedValueOnce([{ label: "broadcast" }]).mockResolvedValueOnce([])

      const { runDisableBroadcastOutput } = await loadCommandModule()
      const deps = baseDeps()

      await runDisableBroadcastOutput(
        {
          outputId: "main",
          isPreviewOpen: false,
          ndiActive: false,
          ndiFrameRate: "fps24",
          ndiResolution: "r1080p",
        },
        deps,
      )

      expect(mockInvoke).toHaveBeenCalledWith("close_broadcast_window", {
        outputId: "main",
      })
      expect(deps.onPreviewOpenChange).toHaveBeenCalledWith(false)
    })

    it("does not emit inactive NDI config when stop fails", async () => {
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "get_ndi_status") {
          return { active: true, width: 1920, height: 1080, fps: 24 }
        }
        if (command === "stop_ndi") throw new Error("stop failed")
        return undefined
      })
      mockGetAllWindows.mockResolvedValue([])

      const { runDisableBroadcastOutput } = await loadCommandModule()
      const deps = baseDeps()

      await runDisableBroadcastOutput(
        {
          outputId: "main",
          isPreviewOpen: false,
          ndiActive: true,
          ndiFrameRate: "fps24",
          ndiResolution: "r1080p",
        },
        deps,
      )

      expect(deps.emitNdiConfig).not.toHaveBeenCalled()
      expect(deps.onError).toHaveBeenCalledWith("Could not stop NDI output", expect.any(Error))
      expect(deps.onNdiActiveChange).toHaveBeenCalledWith(true)
    })
  })

  describe("useBroadcastOutputSettings hook", () => {
    async function renderHookResult(open = true) {
      const { useBroadcastOutputSettings } = await loadCommandModule()
      let rendered!: RenderHookResult<ReturnType<typeof useBroadcastOutputSettings>, never>

      await act(async () => {
        rendered = renderHook(() =>
          useBroadcastOutputSettings("main", {
            open,
            ndiSdkInstalled: true,
            monitors: sampleMonitors,
          }),
        )
        await Promise.resolve()
        await Promise.resolve()
      })

      return {
        result: rendered.result,
        cleanup: () => {
          rendered.unmount()
        },
      }
    }

    it("derives enabled from active NDI status when the dialog opens", async () => {
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "get_ndi_status") {
          return { active: true, width: 1920, height: 1080, fps: 24 }
        }
        return undefined
      })
      mockGetAllWindows.mockResolvedValue([])

      const { result, cleanup } = await renderHookResult(true)

      await waitFor(
        () => {
          expect(result.current?.enabled).toBe(true)
          expect(result.current?.ndiActive).toBe(true)
        },
        { timeout: 2000 },
      )
      expect(result.current?.outputType).toBe("ndi")
      cleanup()
    })

    it("polls NDI status while the dialog stays open", async () => {
      vi.useFakeTimers()
      let pollCount = 0
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "get_ndi_status") {
          pollCount += 1
          if (pollCount > 1) {
            return { active: true, width: 1280, height: 720, fps: 60 }
          }
          return null
        }
        return undefined
      })
      mockGetAllWindows.mockResolvedValue([])

      const { result, cleanup } = await renderHookResult(true)
      expect(result.current?.ndiActive).toBe(false)

      await act(async () => {
        // Preview reconcile retries for up to ~1s before the first NDI poll runs.
        await vi.advanceTimersByTimeAsync(1750)
      })

      expect(result.current?.ndiActive).toBe(true)
      expect(result.current?.outputType).toBe("ndi")
      expect(result.current?.ndiResolution).toBe("r720p")
      expect(result.current?.ndiFrameRate).toBe("fps60")
      cleanup()
      vi.useRealTimers()
    }, 10_000)

    it("does not start NDI from the hook toggle while inactive", async () => {
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "get_ndi_status") return null
        return undefined
      })
      mockGetAllWindows.mockResolvedValue([])

      const { result, cleanup } = await renderHookResult(true)
      const toggle = result.current?.handleToggleNdi
      expect(toggle).toBeDefined()

      await act(async () => {
        await Promise.all([toggle?.(), toggle?.()])
      })

      expect(mockInvoke.mock.calls.filter((call) => call[0] === "start_ndi")).toHaveLength(0)
      expect(mockToastError).toHaveBeenCalledWith(
        "NDI output is coming soon.",
        { description: "Use External Display over HDMI while NDI is being verified." },
      )
      cleanup()
    })

    it("keeps the master toggle pending while joining an in-flight preview toggle", async () => {
      const openWindow = createDeferred<void>()
      let previewExists = false
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "open_broadcast_window") {
          await openWindow.promise
          previewExists = true
          return undefined
        }
        if (command === "get_ndi_status") return null
        return undefined
      })
      mockGetAllWindows.mockImplementation(async () =>
        previewExists ? [{ label: "broadcast" }] : [],
      )

      const { result, cleanup } = await renderHookResult(true)
      const togglePreview = result.current?.handleTogglePreview
      const toggleEnabled = result.current?.handleToggleEnabled
      expect(togglePreview).toBeDefined()
      expect(toggleEnabled).toBeDefined()

      let previewToggle: Promise<unknown> | undefined
      await act(async () => {
        previewToggle = togglePreview?.()
        await Promise.resolve()
      })

      let enabledToggle: Promise<unknown> | undefined
      await act(async () => {
        enabledToggle = toggleEnabled?.(true)
        await Promise.resolve()
      })

      expect(result.current?.previewPending).toBe(true)
      expect(result.current?.enabledPending).toBe(true)
      expect(
        mockInvoke.mock.calls.filter((call) => call[0] === "open_broadcast_window"),
      ).toHaveLength(1)

      let duplicateEnabledToggle: Promise<unknown> | undefined
      await act(async () => {
        duplicateEnabledToggle = result.current?.handleToggleEnabled(true)
        await Promise.resolve()
      })
      expect(
        mockInvoke.mock.calls.filter((call) => call[0] === "open_broadcast_window"),
      ).toHaveLength(1)

      openWindow.resolve()
      await act(async () => {
        await Promise.all([previewToggle, enabledToggle, duplicateEnabledToggle])
      })

      expect(result.current?.previewPending).toBe(false)
      expect(result.current?.enabledPending).toBe(false)
      cleanup()
    })

    it("turns off after an in-flight master preview open completes", async () => {
      const openWindow = createDeferred<void>()
      let previewExists = false
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "open_broadcast_window") return openWindow.promise
        if (command === "close_broadcast_window") {
          previewExists = false
          return undefined
        }
        if (command === "get_ndi_status") return null
        return undefined
      })
      mockGetAllWindows.mockImplementation(async () =>
        previewExists ? [{ label: "broadcast" }] : [],
      )

      const { result, cleanup } = await renderHookResult(true)
      const toggleEnabled = result.current?.handleToggleEnabled
      expect(toggleEnabled).toBeDefined()

      let enableToggle: Promise<unknown> | undefined
      await act(async () => {
        enableToggle = toggleEnabled?.(true)
        await Promise.resolve()
      })

      let disableToggle: Promise<unknown> | undefined
      await act(async () => {
        disableToggle = toggleEnabled?.(false)
        await Promise.resolve()
      })

      expect(result.current?.enabledPending).toBe(true)
      expect(
        mockInvoke.mock.calls.filter((call) => call[0] === "close_broadcast_window"),
      ).toHaveLength(0)

      previewExists = true
      openWindow.resolve()
      await act(async () => {
        await Promise.all([enableToggle, disableToggle])
      })

      expect(mockInvoke.mock.calls.map((call) => call[0])).toContain("close_broadcast_window")
      expect(result.current?.isPreviewOpen).toBe(false)
      expect(result.current?.enabledPending).toBe(false)
      cleanup()
    })

    it("does not enable an inactive NDI output from the master toggle", async () => {
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "get_ndi_status") return null
        return undefined
      })
      mockGetAllWindows.mockResolvedValue([])

      const { result, cleanup } = await renderHookResult(true)
      await act(async () => {
        result.current?.setOutputType("ndi")
      })

      const toggleNdi = result.current?.handleToggleNdi
      const toggleEnabled = result.current?.handleToggleEnabled
      expect(toggleNdi).toBeDefined()
      expect(toggleEnabled).toBeDefined()

      let enabledToggle: Promise<unknown> | undefined
      await act(async () => {
        enabledToggle = toggleEnabled?.(true)
        await Promise.resolve()
      })

      await act(async () => {
        await enabledToggle
      })

      expect(mockInvoke.mock.calls.filter((call) => call[0] === "start_ndi")).toHaveLength(0)
      expect(mockToastError).toHaveBeenCalledWith(
        "NDI output is coming soon.",
        { description: "Use External Display over HDMI while NDI is being verified." },
      )
      expect(result.current?.ndiPending).toBe(false)
      expect(result.current?.enabledPending).toBe(false)
      cleanup()
    })
  })
})
