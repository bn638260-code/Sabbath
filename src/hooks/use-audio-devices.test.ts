// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockInvoke = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => mockInvoke(...args),
}))

describe("use-audio-devices", () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("fetchAudioDevices", () => {
    it("returns devices from get_audio_devices on success", async () => {
      const devices = [
        {
          id: "mic-1",
          name: "USB Mic",
          sample_rate: 48000,
          channels: 1,
          is_default: true,
        },
      ]
      mockInvoke.mockResolvedValue(devices)

      const { fetchAudioDevices } = await import("./use-audio-devices")
      await expect(fetchAudioDevices()).resolves.toEqual(devices)
      expect(mockInvoke).toHaveBeenCalledWith("get_audio_devices")
    })

    it("returns an empty list when the Tauri command fails", async () => {
      mockInvoke.mockRejectedValue(new Error("no runtime"))

      const { fetchAudioDevices } = await import("./use-audio-devices")
      await expect(fetchAudioDevices()).resolves.toEqual([])
    })
  })

  describe("useAudioDevices cleanup", () => {
    it("clears the deferred load timeout on unmount", async () => {
      vi.useFakeTimers()
      mockInvoke.mockResolvedValue([])

      const reactDom = await import("react-dom/client")
      const { flushSync } = await import("react-dom")
      const React = await import("react")
      const { useAudioDevices } = await import("./use-audio-devices")

      function Probe() {
        useAudioDevices()
        return null
      }

      const container = document.createElement("div")
      const root = reactDom.createRoot(container)

      flushSync(() => {
        root.render(React.createElement(Probe))
      })
      await vi.runOnlyPendingTimersAsync()
      await vi.waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("get_audio_devices")
      })

      mockInvoke.mockClear()
      flushSync(() => {
        root.unmount()
      })
      await vi.runOnlyPendingTimersAsync()
      expect(mockInvoke).not.toHaveBeenCalled()
    })
  })
})
