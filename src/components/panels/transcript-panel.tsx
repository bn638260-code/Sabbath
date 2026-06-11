import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react"
import { PanelHeader } from "@/components/ui/panel-header"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { LevelMeter } from "@/components/ui/level-meter"
import { Button } from "@/components/ui/button"
import { MicIcon, MicOffIcon, Trash2Icon } from "lucide-react"
import { profileDetectionEvent } from "@/lib/detection-profiler"
import { cn } from "@/lib/utils"
import { useAudioStore } from "@/stores/audio-store"
import { useBibleStore } from "@/stores/bible-store"
import { useTranscriptStore } from "@/stores/transcript-store"
import { useTauriEvent } from "@/hooks/use-tauri-event"
import { useTranscription } from "@/hooks/use-transcription"
import {
  handleReadingAdvance,
  handleVerseDetections,
} from "@/lib/verse-detection-workflow"
import type { DetectionResult, ReadingAdvance } from "@/types"

const LazyApiKeyPrompt = lazy(() =>
  import("@/components/ui/api-key-prompt").then((mod) => ({
    default: mod.ApiKeyPrompt,
  })),
)

/**
 * Leaf component that subscribes to the audio level only. Isolated so the
 * high-frequency `audio_level` tick (many times per second during recording)
 * does NOT re-render the transcript list, connection dot, or button subtree.
 */
function AudioLevelMeter() {
  const rms = useAudioStore((s) => s.level.rms)
  return <LevelMeter level={rms} bars={6} />
}

/**
 * Leaf component that subscribes to `currentPartial`. Partials update per audio tick.
 */
function LivePartialLine({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const currentPartial = useTranscriptStore((s) => s.currentPartial)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [currentPartial, scrollRef])

  if (!currentPartial) return null

  return (
    <p className="border-l-2 border-primary pl-2 text-base leading-relaxed text-foreground">
      {currentPartial}
      <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-primary align-middle" />
    </p>
  )
}

export function TranscriptPanel({ className }: { className?: string }) {
  const [showKeyPrompt, setShowKeyPrompt] = useState(false)
  const onMissingApiKey = useCallback(() => setShowKeyPrompt(true), [])
  const {
    segments,
    isTranscribing,
    connectionStatus,
    startTranscription,
    stopTranscription,
    dumpTranscriptMemory,
  } = useTranscription({ onMissingApiKey })
  const hasPartial = useTranscriptStore((s) => s.currentPartial.length > 0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useTauriEvent<{ rms: number; peak: number }>("audio_level", (payload) => {
    useAudioStore.getState().setLevel(payload)
  })

  // Listen for voice translation commands: "read in NIV", "switch to ESV"
  useTauriEvent<{ abbreviation: string; translation_id: number }>(
    "translation_command",
    (data) => {
      useBibleStore.getState().setActiveTranslation(data.translation_id)
      if (import.meta.env.DEV) {
        console.log(`[VOICE] Translation switched to ${data.abbreviation}`)
      }
    }
  )

  // Listen for detection results from the backend (batch replaces previous detections)
  useTauriEvent<DetectionResult[]>("verse_detections", (detections) => {
    profileDetectionEvent("verse_detections", detections.length, () => {
      void handleVerseDetections(detections)
    })
  })

  // Reading mode navigation: auto-navigate book panel when reading mode
  // advances to a new verse (chapter commands, verse commands, text matching).
  // Does NOT add to queue — only direct/semantic feed the queue.
  useTauriEvent<ReadingAdvance>("reading_mode_verse", (advance) => {
    profileDetectionEvent("reading_mode_verse", 1, () => {
      handleReadingAdvance(advance)
    })
  })

  // Auto-scroll on segment additions. Partial-driven scrolling lives in
  // LivePartialLine so the panel doesn't re-render per audio tick.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [segments])

  return (
    <div
      data-slot="transcript-panel"
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      <PanelHeader
        title="Live transcript"
        icon={<MicIcon className="size-3" />}
        step={1}
      >
        <div className="flex items-end gap-2 pb-px">
          {(segments.length > 0 || hasPartial) && (
            <button
              onClick={() => void dumpTranscriptMemory()}
              className="mb-0.5 flex items-center gap-1 text-[0.625rem] text-muted-foreground transition-colors hover:text-foreground"
              title="Clear transcript and reset STT session memory"
            >
              <Trash2Icon className="size-3" />
              Dump
            </button>
          )}
          {isTranscribing && (
            <span
              className={cn(
                "transcript-recording-dot mb-1 size-1.5 rounded-full",
                connectionStatus === "connected"
                  ? "bg-emerald-500"
                  : connectionStatus === "connecting"
                    ? "animate-pulse bg-amber-500"
                    : connectionStatus === "error"
                      ? "bg-red-500"
                      : "bg-muted-foreground/40"
              )}
              title={connectionStatus}
            />
          )}
          <AudioLevelMeter />
        </div>
      </PanelHeader>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2 p-3">
          {/* Faded top gradient */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-linear-to-b from-card to-transparent" />

          {segments.length === 0 && !hasPartial && !isTranscribing && (
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <PanelEmptyState
                icon={<MicOffIcon className="size-8" />}
                title="No transcript yet"
                description="Click Start transcribing to begin capturing live speech."
              />
            </div>
          )}

          {/* Final segments — recent ones brighter, older ones fade */}
          {segments.map((seg, idx) => {
            const distFromEnd = segments.length - 1 - idx
            const opacity =
              distFromEnd === 0
                ? "text-foreground/80"
                : distFromEnd === 1
                  ? "text-foreground/60"
                  : distFromEnd <= 3
                    ? "text-foreground/40"
                    : "text-foreground/25"
            return (
              <p
                key={seg.id}
                className={`text-sm leading-relaxed transition-colors duration-300 ${opacity}`}
              >
                {seg.text}
              </p>
            )
          })}

          {/* Partial (in-progress) text rendered by leaf subscriber */}
          <LivePartialLine scrollRef={scrollRef} />
        </div>
      </div>

      {/* Bottom control */}
      <div className="flex gap-2 border-t border-white/5 px-3 py-2">
        {isTranscribing ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={stopTranscription}
          >
            <MicOffIcon className="size-3" />
            Stop transcribing
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={startTranscription}>
              <MicIcon className="size-3" />
            Start transcribing
          </Button>
        )}
      </div>

      {showKeyPrompt ? (
        <Suspense fallback={null}>
          <LazyApiKeyPrompt
            open={showKeyPrompt}
            onOpenChange={setShowKeyPrompt}
            service="Deepgram"
            description="Live transcription needs a Deepgram API key. Add it in settings so the app can start listening."
          />
        </Suspense>
      ) : null}
    </div>
  )
}
