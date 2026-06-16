import { useCallback } from "react"
import { invokeTauri } from "@/lib/tauri-runtime"
import { toast } from "sonner"
import { useAudioStore } from "@/stores/audio-store"
import { useSettingsStore, type SttProvider } from "@/stores/settings-store"
import { useTranscriptStore } from "@/stores/transcript-store"
import { handleSermonSlideVoiceControl } from "@/services/slides/sermon-slide-voice-control"
import { useTauriEvent } from "./use-tauri-event"

interface TranscriptPartialPayload {
  text: string
  is_final: boolean
  confidence: number
  words: Array<{
    text: string
    start: number
    end: number
    confidence: number
    punctuated: string
  }>
}

interface UseTranscriptionOptions {
  /**
   * Called when `start_transcription` fails because the user picked a cloud
   * provider but hasn't set an API key. Panels typically react by
   * opening a key-prompt dialog instead of showing the default toast.
   */
  onMissingApiKey?: (provider: SttProvider) => void
}

const MISSING_DEEPGRAM_KEY_MARKER = "No Deepgram API key"
const MISSING_GLADIA_KEY_MARKER = "No Gladia API key"
const NOT_RUNNING_ERROR = "Transcription is not running"
const MAYBE_HYMN_CUE_PATTERN =
  /\b(?:sda\s+(?:hymn|song)|(?:hymn|song))(?:\s+number)?\s+[a-z0-9]/i

let hymnVoiceControlPromise: Promise<
  typeof import("@/services/hymnal/hymn-voice-control")
> | null = null

function loadHymnVoiceControl() {
  hymnVoiceControlPromise ??= import("@/services/hymnal/hymn-voice-control")
  return hymnVoiceControlPromise
}

export const transcriptionActions = {
  async start(
    onMissingApiKey?: (provider: SttProvider) => void
  ): Promise<void> {
    const transcript = useTranscriptStore.getState()
    transcript.setConnectionStatus("connecting")

    const settings = useSettingsStore.getState()
    try {
      await invokeTauri("start_transcription", {
        deviceId: settings.audioDeviceId,
        gain: settings.gain,
        provider: settings.sttProvider,
        lowPower: settings.lowPowerMode,
        // Low-power machines use the lighter Whisper "fast" profile; otherwise
        // the more accurate "balanced" profile. Ignored by cloud providers.
        whisperProfile: settings.lowPowerMode ? "fast" : "balanced",
      })
      transcript.setTranscribing(true)
    } catch (e) {
      const msg = String(e)
      transcript.setConnectionStatus("error")
      if (
        (msg.includes(MISSING_DEEPGRAM_KEY_MARKER) ||
          msg.includes(MISSING_GLADIA_KEY_MARKER)) &&
        onMissingApiKey
      ) {
        onMissingApiKey(settings.sttProvider)
      } else {
        toast.error("Could not start transcription", { description: msg })
      }
    }
  },

  async stop(): Promise<void> {
    const transcript = useTranscriptStore.getState()
    try {
      await invokeTauri("stop_transcription")
    } catch (e) {
      if (String(e) !== NOT_RUNNING_ERROR) {
        toast.error("Could not stop transcription", { description: String(e) })
      }
    }
    transcript.setTranscribing(false)
    transcript.setPartial("")
    transcript.setConnectionStatus("disconnected")
  },

  async dumpMemory(
    onMissingApiKey?: (provider: SttProvider) => void
  ): Promise<void> {
    const transcript = useTranscriptStore.getState()
    const wasTranscribing = transcript.isTranscribing

    transcript.clearTranscript()
    if (!wasTranscribing) return

    await transcriptionActions.stop()
    await transcriptionActions.start(onMissingApiKey)
  },
}

export async function handleTranscriptFinalPayload(
  payload: TranscriptPartialPayload
): Promise<void> {
  const transcriptStore = useTranscriptStore.getState()
  transcriptStore.setPartial("")
  transcriptStore.addSegment({
    id: crypto.randomUUID(),
    text: payload.text,
    is_final: true,
    confidence: payload.confidence,
    words: payload.words,
    timestamp: Date.now(),
  })
  if (handleSermonSlideVoiceControl(payload.text)) return
  if (!MAYBE_HYMN_CUE_PATTERN.test(payload.text)) return

  const { handleHymnVoiceControl } = await loadHymnVoiceControl()
  await handleHymnVoiceControl(payload.text)
}

export function useTranscription(options?: UseTranscriptionOptions) {
  const segments = useTranscriptStore((s) => s.segments)
  const isTranscribing = useTranscriptStore((s) => s.isTranscribing)
  const connectionStatus = useTranscriptStore((s) => s.connectionStatus)

  // STT lifecycle events
  useTauriEvent("stt_connected", () => {
    useTranscriptStore.getState().setConnectionStatus("connected")
  })
  useTauriEvent("stt_disconnected", () => {
    useTranscriptStore.getState().setConnectionStatus("disconnected")
  })
  useTauriEvent<string>("stt_voice_control", (command) => {
    if (command === "stop") {
      const transcript = useTranscriptStore.getState()
      transcript.setTranscribing(false)
      transcript.setPartial("")
      transcript.setConnectionStatus("disconnected")
    }
  })
  useTauriEvent<string>("stt_error", (msg) => {
    useTranscriptStore.getState().setConnectionStatus("error")
    toast.error("Transcription error", { description: msg })
  })
  useTauriEvent("stt_speech_started", () => {
    useTranscriptStore.getState().setPartial("Speech detected...")
  })

  // Audio source lifecycle: when the OS device disappears (mic unplugged,
  // headset disconnects, app loses access) the watchdog in the Rust fanout
  // thread emits `audio_source_lost`, then `audio_source_recovered` once it
  // sees the device return. The STT provider stays alive across the gap.
  useTauriEvent("audio_source_lost", () => {
    useAudioStore.getState().setSourceLost(true)
    toast.warning("Audio source disconnected", {
      description: "Waiting for the device to come back…",
      id: "audio-source-status",
    })
  })
  useTauriEvent("audio_source_recovered", () => {
    useAudioStore.getState().setSourceLost(false)
    toast.success("Audio source reconnected", {
      id: "audio-source-status",
    })
  })

  useTauriEvent<TranscriptPartialPayload>("transcript_partial", (payload) => {
    useTranscriptStore.getState().setPartial(payload.text)
  })

  useTauriEvent<TranscriptPartialPayload>("transcript_final", (payload) => {
    void handleTranscriptFinalPayload(payload)
  })

  const onMissingApiKey = options?.onMissingApiKey

  const startTranscription = useCallback(
    () => transcriptionActions.start(onMissingApiKey),
    [onMissingApiKey]
  )
  const dumpTranscriptMemory = useCallback(
    () => transcriptionActions.dumpMemory(onMissingApiKey),
    [onMissingApiKey]
  )

  return {
    segments,
    isTranscribing,
    connectionStatus,
    startTranscription,
    stopTranscription: transcriptionActions.stop,
    dumpTranscriptMemory,
  }
}
