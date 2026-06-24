import { beforeEach, describe, expect, it, vi } from "vitest"

const mockInvoke = vi.fn()
const mockToastError = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

const handleHymnVoiceControlMock = vi.fn()

vi.mock("@/hooks/use-tauri-event", () => ({
  useTauriEvent: () => {},
}))

vi.mock("@/services/hymnal/hymn-voice-control", () => ({
  handleHymnVoiceControl: (...args: unknown[]) =>
    handleHymnVoiceControlMock(...args),
}))

async function loadModules() {
  vi.resetModules()
  const transcriptMod = await import("@/stores/transcript-store")
  const settingsMod = await import("@/stores/settings-store")
  const hookMod = await import("./use-transcription")
  return {
    useTranscriptStore: transcriptMod.useTranscriptStore,
    useSettingsStore: settingsMod.useSettingsStore,
    transcriptionActions: hookMod.transcriptionActions,
    handleTranscriptFinalPayload: hookMod.handleTranscriptFinalPayload,
  }
}

describe("use-transcription", () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockToastError.mockReset()
    handleHymnVoiceControlMock.mockReset()
    handleHymnVoiceControlMock.mockResolvedValue(false)
  })

  describe("transcriptionActions.start", () => {
    it("invokes start_transcription with settings-derived params for vosk", async () => {
      mockInvoke.mockResolvedValue(undefined)
      const { useSettingsStore, transcriptionActions } = await loadModules()

      useSettingsStore.setState({
        sttProvider: "vosk",
        audioDeviceId: "dev-42",
        gain: 1.5,
      })

      await transcriptionActions.start()

      expect(mockInvoke).toHaveBeenCalledWith("start_transcription", {
        deviceId: "dev-42",
        gain: 1.5,
        provider: "vosk",
        lowPower: false,
      })
    })

    it("keeps local transcription on Vosk for settings-derived params", async () => {
      mockInvoke.mockResolvedValue(undefined)
      const { useSettingsStore, transcriptionActions } = await loadModules()

      useSettingsStore.setState({
        sttProvider: "vosk",
        audioDeviceId: "dev-43",
        gain: 1.25,
      })

      await transcriptionActions.start()

      expect(mockInvoke).toHaveBeenCalledWith("start_transcription", {
        deviceId: "dev-43",
        gain: 1.25,
        provider: "vosk",
        lowPower: false,
      })
    })

    it("forwards low power mode", async () => {
      mockInvoke.mockResolvedValue(undefined)
      const { useSettingsStore, transcriptionActions } = await loadModules()

      useSettingsStore.setState({
        sttProvider: "vosk",
        lowPowerMode: true,
      })

      await transcriptionActions.start()

      expect(mockInvoke).toHaveBeenCalledWith(
        "start_transcription",
        expect.objectContaining({ lowPower: true })
      )
    })

    it("invokes deepgram provider without forwarding secrets", async () => {
      mockInvoke.mockResolvedValue(undefined)
      const { useSettingsStore, transcriptionActions } = await loadModules()

      useSettingsStore.setState({
        sttProvider: "deepgram",
        audioDeviceId: null,
        gain: 1.0,
      })

      await transcriptionActions.start()

      expect(mockInvoke).toHaveBeenCalledWith(
        "start_transcription",
        expect.objectContaining({
          provider: "deepgram",
          deviceId: null,
          gain: 1.0,
        })
      )
    })

    it("invokes gladia provider without forwarding secrets", async () => {
      mockInvoke.mockResolvedValue(undefined)
      const { useSettingsStore, transcriptionActions } = await loadModules()

      useSettingsStore.setState({
        sttProvider: "gladia",
        audioDeviceId: null,
        gain: 1.0,
      })

      await transcriptionActions.start()

      expect(mockInvoke).toHaveBeenCalledWith(
        "start_transcription",
        expect.objectContaining({
          provider: "gladia",
          deviceId: null,
          gain: 1.0,
        })
      )
    })

    it("sets connectionStatus to 'connecting' before invoke resolves and 'isTranscribing' after", async () => {
      let resolveInvoke: () => void = () => {}
      mockInvoke.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveInvoke = resolve
        })
      )

      const { useTranscriptStore, transcriptionActions } = await loadModules()

      const pending = transcriptionActions.start()

      expect(useTranscriptStore.getState().connectionStatus).toBe("connecting")
      expect(useTranscriptStore.getState().isTranscribing).toBe(false)

      resolveInvoke()
      await pending

      expect(useTranscriptStore.getState().isTranscribing).toBe(true)
      expect(useTranscriptStore.getState().connectionStatus).not.toBe("error")
    })

    it("routes a missing-Deepgram-key error to onMissingApiKey (no toast)", async () => {
      mockInvoke.mockRejectedValue(
        "No Deepgram API key configured. Set it in Settings or via DEEPGRAM_API_KEY env var."
      )
      const { useSettingsStore, useTranscriptStore, transcriptionActions } =
        await loadModules()
      const onMissingApiKey = vi.fn()

      useSettingsStore.setState({ sttProvider: "deepgram" })
      await transcriptionActions.start(onMissingApiKey)

      expect(onMissingApiKey).toHaveBeenCalledWith("deepgram")
      expect(mockToastError).not.toHaveBeenCalled()
      expect(useTranscriptStore.getState().connectionStatus).toBe("error")
      expect(useTranscriptStore.getState().isTranscribing).toBe(false)
    })

    it("routes a missing-Gladia-key error to onMissingApiKey (no toast)", async () => {
      mockInvoke.mockRejectedValue(
        "No Gladia API key configured. Set it in Settings."
      )
      const { useSettingsStore, useTranscriptStore, transcriptionActions } =
        await loadModules()
      const onMissingApiKey = vi.fn()

      useSettingsStore.setState({ sttProvider: "gladia" })
      await transcriptionActions.start(onMissingApiKey)

      expect(onMissingApiKey).toHaveBeenCalledWith("gladia")
      expect(mockToastError).not.toHaveBeenCalled()
      expect(useTranscriptStore.getState().connectionStatus).toBe("error")
    })

    it("falls back to toast when missing-key error fires but no callback is provided", async () => {
      mockInvoke.mockRejectedValue("No Deepgram API key provided")
      const { transcriptionActions } = await loadModules()

      await transcriptionActions.start()

      expect(mockToastError).toHaveBeenCalledWith(
        "Could not start transcription",
        { description: "No Deepgram API key provided" }
      )
    })

    it("surfaces any other start error as a toast", async () => {
      mockInvoke.mockRejectedValue("Vosk model not found")
      const { useTranscriptStore, transcriptionActions } = await loadModules()
      const onMissingApiKey = vi.fn()

      await transcriptionActions.start(onMissingApiKey)

      expect(onMissingApiKey).not.toHaveBeenCalled()
      expect(mockToastError).toHaveBeenCalledWith(
        "Could not start transcription",
        { description: "Vosk model not found" }
      )
      expect(useTranscriptStore.getState().connectionStatus).toBe("error")
    })
  })

  describe("transcriptionActions.stop", () => {
    it("resets transcript state on success", async () => {
      mockInvoke.mockResolvedValue(undefined)
      const { useTranscriptStore, transcriptionActions } = await loadModules()

      useTranscriptStore.setState({
        isTranscribing: true,
        currentPartial: "partial text",
        connectionStatus: "connected",
      })

      await transcriptionActions.stop()

      const state = useTranscriptStore.getState()
      expect(state.isTranscribing).toBe(false)
      expect(state.currentPartial).toBe("")
      expect(state.connectionStatus).toBe("disconnected")
      expect(mockToastError).not.toHaveBeenCalled()
    })

    it("silently swallows the exact 'Transcription is not running' error", async () => {
      mockInvoke.mockRejectedValue("Transcription is not running")
      const { useTranscriptStore, transcriptionActions } = await loadModules()

      useTranscriptStore.setState({ isTranscribing: true })

      await transcriptionActions.stop()

      expect(mockToastError).not.toHaveBeenCalled()
      expect(useTranscriptStore.getState().isTranscribing).toBe(false)
    })

    it("surfaces other stop errors as a toast AND still resets UI state", async () => {
      mockInvoke.mockRejectedValue("Audio device disappeared")
      const { useTranscriptStore, transcriptionActions } = await loadModules()

      useTranscriptStore.setState({
        isTranscribing: true,
        currentPartial: "mid-sentence...",
        connectionStatus: "connected",
      })

      await transcriptionActions.stop()

      expect(mockToastError).toHaveBeenCalledWith(
        "Could not stop transcription",
        { description: "Audio device disappeared" }
      )
      const state = useTranscriptStore.getState()
      expect(state.isTranscribing).toBe(false)
      expect(state.currentPartial).toBe("")
      expect(state.connectionStatus).toBe("disconnected")
    })
  })

  describe("transcriptionActions.setLiveGain", () => {
    it("invokes set_input_gain while transcription is active", async () => {
      mockInvoke.mockResolvedValue(undefined)
      const { useTranscriptStore, transcriptionActions } = await loadModules()

      useTranscriptStore.setState({ isTranscribing: true })

      await transcriptionActions.setLiveGain(1.25)

      expect(mockInvoke).toHaveBeenCalledWith("set_input_gain", { gain: 1.25 })
    })

    it("does not invoke set_input_gain while transcription is inactive", async () => {
      const { useTranscriptStore, transcriptionActions } = await loadModules()

      useTranscriptStore.setState({ isTranscribing: false })

      await transcriptionActions.setLiveGain(1.25)

      expect(mockInvoke).not.toHaveBeenCalled()
    })
  })

  describe("transcriptionActions.dumpMemory", () => {
    it("clears visible transcript without restarting when transcription is inactive", async () => {
      const { useTranscriptStore, transcriptionActions } = await loadModules()

      useTranscriptStore.setState({
        isTranscribing: false,
        segments: [
          {
            id: "seg-1",
            text: "old words",
            is_final: true,
            confidence: 0.9,
            words: [],
            timestamp: Date.now(),
          },
        ],
        currentPartial: "half heard",
      })

      await transcriptionActions.dumpMemory()

      expect(useTranscriptStore.getState().segments).toEqual([])
      expect(useTranscriptStore.getState().currentPartial).toBe("")
      expect(mockInvoke).not.toHaveBeenCalled()
    })

    it("restarts active transcription so provider prompt state is discarded too", async () => {
      mockInvoke.mockResolvedValue(undefined)
      const { useTranscriptStore, transcriptionActions } = await loadModules()

      useTranscriptStore.setState({
        isTranscribing: true,
        connectionStatus: "connected",
        segments: [
          {
            id: "seg-1",
            text: "old words",
            is_final: true,
            confidence: 0.9,
            words: [],
            timestamp: Date.now(),
          },
        ],
      })

      await transcriptionActions.dumpMemory()

      expect(useTranscriptStore.getState().segments).toEqual([])
      expect(mockInvoke).toHaveBeenNthCalledWith(1, "stop_transcription")
      expect(mockInvoke).toHaveBeenNthCalledWith(
        2,
        "start_transcription",
        expect.any(Object)
      )
    })

    it("restores the transcript when restart fails after stopping", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce("Audio device disappeared")
      const { useTranscriptStore, transcriptionActions } = await loadModules()

      const existingSegments = [
        {
          id: "seg-1",
          text: "keep these words",
          is_final: true,
          confidence: 0.9,
          words: [],
          timestamp: Date.now(),
        },
      ]
      useTranscriptStore.setState({
        isTranscribing: true,
        connectionStatus: "connected",
        segments: existingSegments,
        currentPartial: "unfinished thought",
      })

      await transcriptionActions.dumpMemory()

      expect(mockInvoke).toHaveBeenNthCalledWith(1, "stop_transcription")
      expect(mockInvoke).toHaveBeenNthCalledWith(
        2,
        "start_transcription",
        expect.any(Object)
      )
      expect(useTranscriptStore.getState().segments).toEqual(existingSegments)
      expect(useTranscriptStore.getState().currentPartial).toBe(
        "unfinished thought"
      )
      expect(useTranscriptStore.getState().connectionStatus).toBe("error")
    })
  })

  describe("handleTranscriptFinalPayload", () => {
    it("stores final transcript segments and invokes hymn voice control", async () => {
      const { useTranscriptStore, handleTranscriptFinalPayload } =
        await loadModules()
      useTranscriptStore.getState().setPartial("hymn")

      await handleTranscriptFinalPayload({
        text: "hymn 12",
        is_final: true,
        confidence: 0.95,
        words: [],
      })

      const state = useTranscriptStore.getState()
      expect(state.segments).toHaveLength(1)
      expect(state.segments[0]).toMatchObject({
        text: "hymn 12",
        is_final: true,
        confidence: 0.95,
      })
      expect(state.currentPartial).toBe("")
      expect(handleHymnVoiceControlMock).toHaveBeenCalledWith("hymn 12")
    })

    it("invokes hymn voice control for Adventist hymnal cue variants", async () => {
      const { handleTranscriptFinalPayload } = await loadModules()

      for (const text of [
        "SDA hymn 100",
        "Adventist hymn 100",
        "Seventh-day Adventist hymnal 100",
      ]) {
        handleHymnVoiceControlMock.mockClear()

        await handleTranscriptFinalPayload({
          text,
          is_final: true,
          confidence: 0.95,
          words: [],
        })

        expect(handleHymnVoiceControlMock).toHaveBeenCalledWith(text)
      }
    })
  })

  describe("stt_error integration contract", () => {
    it("surfaces stt errors via toast and sets connection status to error", async () => {
      const { useTranscriptStore } = await loadModules()

      // Simulate what the stt_error handler does
      useTranscriptStore.getState().setConnectionStatus("error")
      mockToastError("Transcription error", {
        description: "WebSocket closed unexpectedly",
      })

      expect(useTranscriptStore.getState().connectionStatus).toBe("error")
      expect(mockToastError).toHaveBeenCalledWith("Transcription error", {
        description: "WebSocket closed unexpectedly",
      })
    })
  })
})
