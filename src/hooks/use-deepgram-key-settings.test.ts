import { beforeEach, describe, expect, it, vi } from "vitest"

const mockInvoke = vi.fn()
const mockStop = vi.fn()
const mockStart = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock("@/hooks/use-transcription", () => ({
  transcriptionActions: {
    stop: (...args: unknown[]) => mockStop(...args),
    start: (...args: unknown[]) => mockStart(...args),
  },
}))

async function loadModules() {
  vi.resetModules()
  const transcriptMod = await import("@/stores/transcript-store")
  const mod = await import("./use-deepgram-key-settings")
  return {
    useTranscriptStore: transcriptMod.useTranscriptStore,
    saveDeepgramApiKey: mod.saveDeepgramApiKey,
    clearDeepgramApiKey: mod.clearDeepgramApiKey,
    restartActiveTranscriptionIfNeeded: mod.restartActiveTranscriptionIfNeeded,
  }
}

describe("use-deepgram-key-settings", () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockStop.mockReset()
    mockStart.mockReset()
    mockStop.mockResolvedValue(undefined)
    mockStart.mockResolvedValue(undefined)
  })

  describe("saveDeepgramApiKey", () => {
    it("persists the key and reports success when has_deepgram_api_key is true", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(true)

      const { saveDeepgramApiKey } = await loadModules()
      await expect(saveDeepgramApiKey("secret-key")).resolves.toEqual({
        hasKey: true,
      })
      expect(mockInvoke).toHaveBeenNthCalledWith(1, "set_deepgram_api_key", {
        apiKey: "secret-key",
      })
      expect(mockInvoke).toHaveBeenNthCalledWith(2, "has_deepgram_api_key")
    })

    it("returns an error when the key is not stored", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(false)

      const { saveDeepgramApiKey } = await loadModules()
      await expect(saveDeepgramApiKey("bad-key")).resolves.toEqual({
        hasKey: false,
        error: "Deepgram API key was not saved",
      })
    })

    it("returns command failures without throwing", async () => {
      mockInvoke.mockRejectedValue(new Error("keychain unavailable"))

      const { saveDeepgramApiKey } = await loadModules()
      await expect(saveDeepgramApiKey("secret-key")).resolves.toEqual({
        hasKey: false,
        error: "Error: keychain unavailable",
      })
    })
  })

  describe("clearDeepgramApiKey", () => {
    it("clears the stored key on success", async () => {
      mockInvoke.mockResolvedValue(undefined)

      const { clearDeepgramApiKey } = await loadModules()
      await expect(clearDeepgramApiKey()).resolves.toEqual({})
      expect(mockInvoke).toHaveBeenCalledWith("clear_deepgram_api_key")
    })

    it("returns command failures without throwing", async () => {
      mockInvoke.mockRejectedValue(new Error("clear failed"))

      const { clearDeepgramApiKey } = await loadModules()
      await expect(clearDeepgramApiKey()).resolves.toEqual({
        error: "Error: clear failed",
      })
    })
  })

  describe("restartActiveTranscriptionIfNeeded", () => {
    it("does nothing when transcription is not active", async () => {
      const { useTranscriptStore, restartActiveTranscriptionIfNeeded } =
        await loadModules()
      useTranscriptStore.setState({ isTranscribing: false })

      await restartActiveTranscriptionIfNeeded()

      expect(mockStop).not.toHaveBeenCalled()
      expect(mockStart).not.toHaveBeenCalled()
    })

    it("restarts transcription when active", async () => {
      vi.useFakeTimers()
      const { useTranscriptStore, restartActiveTranscriptionIfNeeded } =
        await loadModules()
      useTranscriptStore.setState({ isTranscribing: true })

      const restartPromise = restartActiveTranscriptionIfNeeded()
      await vi.advanceTimersByTimeAsync(350)
      await restartPromise

      expect(mockStop).toHaveBeenCalledTimes(1)
      expect(mockStart).toHaveBeenCalledTimes(1)
      vi.useRealTimers()
    })
  })
})
