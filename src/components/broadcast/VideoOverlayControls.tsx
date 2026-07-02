import { useEffect, useState } from "react"
import {
  Maximize2Icon,
  Minimize2Icon,
  PauseIcon,
  PlayIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"

// Minimal in-video controls replacing the native browser chrome: play/pause
// routed through the caller (so live playback stays in sync with the
// transport bar) and a local fullscreen toggle. Rendered inside the
// fullscreen target so the buttons stay usable in fullscreen.
export function VideoOverlayControls({
  paused,
  onTogglePlay,
  fullscreenTarget,
}: {
  paused: boolean
  onTogglePlay: () => void
  fullscreenTarget: () => HTMLElement | null
}) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [])

  const toggleFullscreen = () => {
    const logFailure = (error: unknown) =>
      console.debug("[video-overlay] fullscreen toggle failed", error)
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(logFailure)
      return
    }
    void fullscreenTarget()?.requestFullscreen().catch(logFailure)
  }

  return (
    <div className="absolute right-2 bottom-2 z-10 flex gap-1.5">
      <Button
        type="button"
        size="icon-xs"
        variant="outline"
        className="bg-black/60"
        title={paused ? "Play video" : "Pause video"}
        onClick={onTogglePlay}
      >
        {paused ? <PlayIcon className="size-3" /> : <PauseIcon className="size-3" />}
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="outline"
        className="bg-black/60"
        title={isFullscreen ? "Exit fullscreen" : "Fullscreen video"}
        onClick={toggleFullscreen}
      >
        {isFullscreen ? (
          <Minimize2Icon className="size-3" />
        ) : (
          <Maximize2Icon className="size-3" />
        )}
      </Button>
    </div>
  )
}
