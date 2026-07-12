import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react"
import { PanelHeader } from "@/components/ui/panel-header"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { LevelMeter } from "@/components/ui/level-meter"
import { Button } from "@/components/ui/button"
import {
  AlertTriangleIcon,
  MicIcon,
  MicOffIcon,
  Trash2Icon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { openSettings } from "@/lib/settings-dialog"
import { useAudioStore } from "@/stores/audio-store"
import type { SttProvider } from "@/stores/settings-store"
import { useTranscriptStore } from "@/stores/transcript-store"
import { useTranscription } from "@/hooks/use-transcription"

const LazyApiKeyPrompt = lazy(() =>
  import("@/components/ui/api-key-prompt").then((mod) => ({
    default: mod.ApiKeyPrompt,
  }))
)
const TRANSCRIPT_STICKY_THRESHOLD_PX = 40

export function isNearTranscriptBottom(
  scrollNode: Pick<
    HTMLDivElement,
    "scrollTop" | "scrollHeight" | "clientHeight"
  >,
  threshold = TRANSCRIPT_STICKY_THRESHOLD_PX
): boolean {
  return (
    scrollNode.scrollHeight - scrollNode.scrollTop - scrollNode.clientHeight <=
    threshold
  )
}

/**
 * Leaf component that subscribes to the audio level only. Isolated so the
 * high-frequency `audio_level` tick (many times per second during recording)
 * does NOT re-render the transcript list, connection dot, or button subtree.
 */
function AudioLevelMeter() {
  const rms = useAudioStore((s) => s.level.rms)
  return <LevelMeter level={rms} bars={6} />
}

function providerLabel(provider: SttProvider): string {
  switch (provider) {
    case "deepgram":
      return "Deepgram"
    case "soniox":
      return "Soniox"
    case "vosk":
      return "Vosk"
  }
}

/**
 * Leaf component that subscribes to `currentPartial`. Partials update per audio tick.
 */
function LivePartialLine({
  scrollRef,
  shouldStickToBottomRef,
}: {
  scrollRef: RefObject<HTMLDivElement | null>
  shouldStickToBottomRef: MutableRefObject<boolean>
}) {
  const currentPartial = useTranscriptStore((s) => s.currentPartial)

  useEffect(() => {
    if (!scrollRef.current || !shouldStickToBottomRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [currentPartial, scrollRef, shouldStickToBottomRef])

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
  const [missingKeyProvider, setMissingKeyProvider] =
    useState<SttProvider>("deepgram")
  const onMissingApiKey = useCallback((provider: SttProvider) => {
    setMissingKeyProvider(provider)
    setShowKeyPrompt(true)
  }, [])
  const {
    segments,
    isTranscribing,
    connectionStatus,
    startTranscription,
    stopTranscription,
    dumpTranscriptMemory,
  } = useTranscription({ onMissingApiKey })
  const hasPartial = useTranscriptStore((s) => s.currentPartial.length > 0)
  const lastIssue = useTranscriptStore((s) => s.lastIssue)
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldStickToBottomRef = useRef(true)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)
  const openIssueSettings = useCallback(() => {
    openSettings("speech")
  }, [])
  const scrollToLatest = useCallback(() => {
    const scrollNode = scrollRef.current
    if (!scrollNode) return
    scrollNode.scrollTop = scrollNode.scrollHeight
    shouldStickToBottomRef.current = true
    setShowJumpToLatest(false)
  }, [])
  const handleTranscriptScroll = useCallback(() => {
    const scrollNode = scrollRef.current
    if (!scrollNode) return
    const isNearBottom = isNearTranscriptBottom(scrollNode)
    shouldStickToBottomRef.current = isNearBottom
    setShowJumpToLatest(!isNearBottom)
  }, [])

  // Auto-scroll on segment additions. Partial-driven scrolling lives in
  // LivePartialLine so the panel doesn't re-render per audio tick.
  useEffect(() => {
    if (shouldStickToBottomRef.current) {
      scrollToLatest()
    }
  }, [scrollToLatest, segments])

  return (
    <div
      data-slot="transcript-panel"
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden",
        className
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

      <div
        data-slot="transcript-controls"
        className="flex gap-2 border-b border-[var(--border-subtle)] px-3 py-2"
      >
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

      <div
        ref={scrollRef}
        data-slot="transcript-scroll"
        className="relative min-h-0 flex-1 overflow-y-auto"
        onScroll={handleTranscriptScroll}
      >
        <div className="flex flex-col gap-2 p-3">
          {/* Faded top gradient */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-linear-to-b from-card to-transparent" />

          {lastIssue ? (
            <div
              aria-live="polite"
              className="rounded-md border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-900 dark:text-red-100"
            >
              <div className="flex items-start gap-2">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-red-700 dark:text-red-300" />
                <div className="min-w-0 flex-1">
                  <p className="leading-snug font-semibold">
                    {lastIssue.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-red-900/80 dark:text-red-100/80">
                    {lastIssue.description}
                  </p>
                  {lastIssue.actionLabel ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="xs"
                      className="mt-3"
                      onClick={openIssueSettings}
                    >
                      {lastIssue.actionLabel}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {segments.length === 0 &&
            !hasPartial &&
            !isTranscribing &&
            !lastIssue && (
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
          <LivePartialLine
            scrollRef={scrollRef}
            shouldStickToBottomRef={shouldStickToBottomRef}
          />
        </div>
        {showJumpToLatest ? (
          <Button
            type="button"
            variant="chrome"
            size="xs"
            className="absolute right-3 bottom-3 z-20 shadow-lg"
            onClick={scrollToLatest}
          >
            Jump to latest
          </Button>
        ) : null}
      </div>

      {showKeyPrompt ? (
        <Suspense fallback={null}>
          <LazyApiKeyPrompt
            open={showKeyPrompt}
            onOpenChange={setShowKeyPrompt}
            service={providerLabel(missingKeyProvider)}
            description={`Live transcription needs a ${providerLabel(
              missingKeyProvider
            )} API key. Add it in settings so the app can start listening.`}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
