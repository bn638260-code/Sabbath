// @vitest-environment jsdom
import { act } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createRoot } from "react-dom/client"
import React from "react"
import type { NdiSessionInfo } from "@/types"
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
    onNdiSdkMissing: vi.fn(),
    emitPostStartNdiConfig: vi.fn(),
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
      mockInvoke.mockResolvedValue(undefined)
      mockGetAllWindows.mockResolvedValue([])

      const { runToggleBroadcastPreview } = await loadCommandModule()
      const deps = baseDeps()

      await runToggleBroadcastPreview(baseState(), deps)

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
  })

  describe("runToggleBroadcastNdi", () => {
    it("starts NDI after ensuring the broadcast window", async () => {
      const session: NdiSessionInfo = {
        sourceName: "SabbathCue Output",
        resolution: "r1080p",
        frameRate: "fps24",
        alphaMode: "straightAlpha",
        width: 1920,
        height: 1080,
        fps: 24,
      }
      mockInvoke.mockResolvedValue(session)

      const { runToggleBroadcastNdi } = await loadCommandModule()
      const deps = baseDeps()

      await runToggleBroadcastNdi(baseState(), deps)

      expect(mockInvoke.mock.calls.map((call) => call[0])).toEqual([
        "ensure_broadcast_window",
        "start_ndi",
      ])
      expect(mockInvoke).toHaveBeenCalledWith("ensure_broadcast_window", {
        outputId: "main",
      })
      expect(mockInvoke).toHaveBeenCalledWith("start_ndi", {
        outputId: "main",
        request: {
          sourceName: "SabbathCue Output",
          resolution: "r1080p",
          frameRate: "fps24",
          alphaMode: "straightAlpha",
        },
      })
      expect(deps.onNdiActiveChange).toHaveBeenCalledWith(true)
      expect(mockEmitTo).toHaveBeenCalledWith("broadcast", "broadcast:ndi-config", {
        active: true,
        fps: 24,
        width: 1920,
        height: 1080,
      })
    })

    it("reports post-start NDI config emit failures", async () => {
      const session: NdiSessionInfo = {
        sourceName: "SabbathCue Output",
        resolution: "r1080p",
        frameRate: "fps24",
        alphaMode: "straightAlpha",
        width: 1920,
        height: 1080,
        fps: 24,
      }
      mockInvoke.mockResolvedValue(session)
      mockEmitTo.mockRejectedValueOnce(new Error("webview missing"))

      const { runToggleBroadcastNdi } = await loadCommandModule()
      const deps = baseDeps()

      await runToggleBroadcastNdi(baseState(), deps)
      await Promise.resolve()

      expect(deps.onIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          outputId: "main",
          kind: "ndi-config",
          title: "NDI config sync failed",
        }),
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

    it("does not invoke NDI commands when the SDK is missing", async () => {
      const { runToggleBroadcastNdi } = await loadCommandModule()
      const deps = baseDeps()

      await runToggleBroadcastNdi(baseState({ ndiSdkInstalled: false }), deps)

      expect(mockInvoke).not.toHaveBeenCalled()
      expect(deps.onNdiSdkMissing).toHaveBeenCalled()
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
      const container = document.createElement("div")
      document.body.appendChild(container)
      const root = createRoot(container)
      const resultHolder: {
        current: ReturnType<typeof useBroadcastOutputSettings> | null
      } = {
        current: null,
      }

      function Probe() {
        const hookResult = useBroadcastOutputSettings("main", {
          open,
          ndiSdkInstalled: true,
          monitors: sampleMonitors,
        })

        resultHolder.current = hookResult

        return null
      }

      await act(async () => {
        root.render(React.createElement(Probe))
        await Promise.resolve()
        await Promise.resolve()
      })

      return {
        result: resultHolder,
        cleanup: () => {
          act(() => {
            root.unmount()
          })
          container.remove()
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
      expect(result.current?.enabled).toBe(true)
      expect(result.current?.ndiActive).toBe(true)
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
        vi.advanceTimersByTime(750)
        await Promise.resolve()
      })

      expect(result.current?.ndiActive).toBe(true)
      expect(result.current?.outputType).toBe("ndi")
      expect(result.current?.ndiResolution).toBe("r720p")
      expect(result.current?.ndiFrameRate).toBe("fps60")
      cleanup()
      vi.useRealTimers()
    })

    it("ignores duplicate NDI toggle calls while the first command is pending", async () => {
      let startCalls = 0
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "start_ndi") {
          startCalls += 1
          return {
            sourceName: "SabbathCue Output",
            resolution: "r1080p",
            frameRate: "fps24",
            alphaMode: "straightAlpha",
            width: 1920,
            height: 1080,
            fps: 24,
          }
        }
        return undefined
      })
      mockGetAllWindows.mockResolvedValue([])

      const { result, cleanup } = await renderHookResult(true)
      const toggle = result.current?.handleToggleNdi
      expect(toggle).toBeDefined()

      await act(async () => {
        await Promise.all([toggle?.(), toggle?.()])
      })

      expect(startCalls).toBe(1)
      cleanup()
    })

    it("keeps the master toggle pending while joining an in-flight preview toggle", async () => {
      const openWindow = createDeferred<void>()
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "open_broadcast_window") return openWindow.promise
        if (command === "get_ndi_status") return null
        return undefined
      })
      mockGetAllWindows.mockResolvedValue([])

      const { result, cleanup } = await renderHookResult(true)
      const togglePreview = result.current?.handleTogglePreview
      const toggleEnabled = result.current?.handleToggleEnabled
      expect(togglePreview).toBeDefined()
      expect(toggleEnabled).toBeDefined()

      let previewToggle: Promise<void> | undefined
      await act(async () => {
        previewToggle = togglePreview?.()
        await Promise.resolve()
      })

      let enabledToggle: Promise<void> | undefined
      await act(async () => {
        enabledToggle = toggleEnabled?.(true)
        await Promise.resolve()
      })

      expect(result.current?.previewPending).toBe(true)
      expect(result.current?.enabledPending).toBe(true)
      expect(
        mockInvoke.mock.calls.filter((call) => call[0] === "open_broadcast_window"),
      ).toHaveLength(1)

      let duplicateEnabledToggle: Promise<void> | undefined
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

      let enableToggle: Promise<void> | undefined
      await act(async () => {
        enableToggle = toggleEnabled?.(true)
        await Promise.resolve()
      })

      let disableToggle: Promise<void> | undefined
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

    it("keeps the master toggle pending while joining an in-flight NDI toggle", async () => {
      const startNdi = createDeferred<NdiSessionInfo>()
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "start_ndi") return startNdi.promise
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

      let ndiToggle: Promise<void> | undefined
      await act(async () => {
        ndiToggle = toggleNdi?.()
        await Promise.resolve()
        await Promise.resolve()
      })

      let enabledToggle: Promise<void> | undefined
      await act(async () => {
        enabledToggle = toggleEnabled?.(true)
        await Promise.resolve()
      })

      expect(result.current?.ndiPending).toBe(true)
      expect(result.current?.enabledPending).toBe(true)
      expect(mockInvoke.mock.calls.filter((call) => call[0] === "start_ndi")).toHaveLength(1)

      let duplicateEnabledToggle: Promise<void> | undefined
      await act(async () => {
        duplicateEnabledToggle = result.current?.handleToggleEnabled(true)
        await Promise.resolve()
      })
      expect(mockInvoke.mock.calls.filter((call) => call[0] === "start_ndi")).toHaveLength(1)

      startNdi.resolve({
        sourceName: "SabbathCue Output",
        resolution: "r1080p",
        frameRate: "fps24",
        alphaMode: "straightAlpha",
        width: 1920,
        height: 1080,
        fps: 24,
      })
      await act(async () => {
        await Promise.all([ndiToggle, enabledToggle, duplicateEnabledToggle])
      })

      expect(result.current?.ndiPending).toBe(false)
      expect(result.current?.enabledPending).toBe(false)
      cleanup()
    })
  })
})
