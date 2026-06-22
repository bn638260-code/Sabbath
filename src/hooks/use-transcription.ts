import { useCallback, useEffect } from "react"
import { invokeTauri } from "@/lib/tauri-runtime"
import { toast } from "sonner"
import { profileDetectionEvent } from "@/lib/detection-profiler"
import {
  handleReadingAdvance,
  handleVerseDetections,
} from "@/lib/verse-detection-workflow"
import { useAudioStore } from "@/stores/audio-store"
import { useBibleStore } from "@/stores/bible-store"
import { useDetectionStore } from "@/stores/detection-store"
import { useSettingsStore, type SttProvider } from "@/stores/settings-store"
import { useTranscriptStore } from "@/stores/transcript-store"
import { handleSermonSlideVoiceControl } from "@/services/slides/sermon-slide-voice-control"
import { loadHymnVoiceControl } from "@/services/hymnal/hymn-voice-control-loader"
import {
  recordWorkflowTrace,
  traceDetectionBatchDetails,
  traceReadingAdvanceDetails,
  traceTranscriptDetails,
} from "@/lib/workflow-trace"
import type { DetectionResult, ReadingAdvance } from "@/types"
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

export const transcriptionActions = {
  async start(
    onMissingApiKey?: (provider: SttProvider) => void
  ): Promise<boolean> {
    const transcript = useTranscriptStore.getState()
    transcript.setConnectionStatus("connecting")

    const settings = useSettingsStore.getState()
    try {
      await invokeTauri("start_transcription", {
        deviceId: settings.audioDeviceId,
        gain: settings.gain,
        provider: settings.sttProvider,
        lowPower: settings.lowPowerMode,
      })
      transcript.setTranscribing(true)
      return true
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
      return false
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
    const previousSegments = transcript.segments
    const previousPartial = transcript.currentPartial

    if (!wasTranscribing) {
      transcript.clearTranscript()
      return
    }

    await transcriptionActions.stop()
    const restarted = await transcriptionActions.start(onMissingApiKey)
    if (restarted) {
      useTranscriptStore.getState().clearTranscript()
      return
    }

    useTranscriptStore.setState({
      segments: previousSegments,
      currentPartial: previousPartial,
    })
  },
}

export async function handleTranscriptFinalPayload(
  payload: TranscriptPartialPayload
): Promise<void> {
  recordWorkflowTrace("transcription.final", "Final transcript received", {
    ...traceTranscriptDetails({
      text: payload.text,
      confidence: payload.confidence,
      isFinal: true,
      wordCount: payload.words.length,
    }),
  })

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

export function useTranscriptionEventBridge() {
  // STT lifecycle events
  useTauriEvent("stt_connected", () => {
    recordWorkflowTrace("transcription.connected", "STT connected")
    useTranscriptStore.getState().setConnectionStatus("connected")
  })
  useTauriEvent("stt_disconnected", () => {
    recordWorkflowTrace("transcription.disconnected", "STT disconnected")
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
    recordWorkflowTrace("transcription.error", "STT error", { message: msg })
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
    recordWorkflowTrace("transcription.partial", "Partial transcript received", {
      ...traceTranscriptDetails({
        text: payload.text,
        confidence: payload.confidence,
        isFinal: false,
        wordCount: payload.words.length,
      }),
    })
    useTranscriptStore.getState().setPartial(payload.text)
  })

  useTauriEvent<TranscriptPartialPayload>("transcript_final", (payload) => {
    void handleTranscriptFinalPayload(payload)
  })

  useTauriEvent<{ rms: number; peak: number }>("audio_level", (payload) => {
    useAudioStore.getState().setLevel(payload)
  })

  // Voice translation commands: "read in NIV", "switch to ESV"
  useTauriEvent<{ abbreviation: string; translation_id: number }>(
    "translation_command",
    (data) => {
      useBibleStore.getState().setActiveTranslation(data.translation_id)
      if (import.meta.env.DEV) {
        console.log(`[VOICE] Translation switched to ${data.abbreviation}`)
      }
    }
  )

  useTauriEvent<DetectionResult[]>("verse_detections", (detections) => {
    recordWorkflowTrace("detection.event", "Verse detections event received", {
      ...traceDetectionBatchDetails(detections),
    })
    profileDetectionEvent("verse_detections", detections.length, () => {
      void handleVerseDetections(detections)
    })
  })

  useTauriEvent<ReadingAdvance>("reading_mode_verse", (advance) => {
    recordWorkflowTrace("reading.event", "Reading-mode verse event received", {
      ...traceReadingAdvanceDetails(advance),
    })
    profileDetectionEvent("reading_mode_verse", 1, () => {
      handleReadingAdvance(advance)
    })
  })

  useEffect(() => {
    const id = setInterval(() => {
      useDetectionStore.getState().evictStale()
    }, 2_000)
    return () => clearInterval(id)
  }, [])
}

export function useTranscription(options?: UseTranscriptionOptions) {
  const segments = useTranscriptStore((s) => s.segments)
  const isTranscribing = useTranscriptStore((s) => s.isTranscribing)
  const connectionStatus = useTranscriptStore((s) => s.connectionStatus)

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
