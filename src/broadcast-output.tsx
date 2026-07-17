import { createRoot } from "react-dom/client"
import { useCallback, useEffect, useState } from "react"
import "@/index.css"
import { useBroadcastVideo } from "@/hooks/use-broadcast-video"
import {
  useBroadcastYoutube,
  useYoutubeEmbedUrl,
} from "@/hooks/use-broadcast-youtube"
import {
  type BroadcastPayload,
  useBroadcastOutputRuntime,
} from "@/hooks/use-broadcast-output-runtime"
import {
  accentThemeClassName,
  type AccentTheme,
} from "@/stores/accent-theme-store"
import type { BroadcastTransitionType, PresentationRenderData } from "@/types"

// The app ships with a single gold accent (the picker was removed); the
// output window pins the same accent rather than reading a stored choice.
function readAccentTheme(): AccentTheme {
  return "gold"
}

function applyAccentThemeToDocument() {
  const theme = readAccentTheme()
  const root = document.documentElement
  root.id = "bodyThemeContainer"
  root.className = `dark ${accentThemeClassName(theme)}`
  document.body.style.margin = "0"
  document.body.style.background = "var(--bg-deep)"
}

/** Read output ID from URL query param (?output=main or ?output=alt). Defaults to "main". */
const outputId =
  new URLSearchParams(window.location.search).get("output") ?? "main"

function videoTransitionClass(type: BroadcastTransitionType | undefined): string {
  if (type === "fade") return "live-anim-fade"
  if (type === "slide") return "live-anim-slide"
  if (type === "scale") return "live-anim-scale"
  return ""
}

function BroadcastCanvas() {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const [youtubeFrame, setYoutubeFrame] = useState<HTMLIFrameElement | null>(null)
  const [item, setItem] = useState<PresentationRenderData | null>(null)
  const [videoTransition, setVideoTransition] = useState("")
  const videoItem = item?.kind === "video" ? item : null
  const youtubeSrc = useYoutubeEmbedUrl(videoItem?.video?.youtubeId)
  const isYoutube = videoItem?.video?.source === "youtube"
  const handlePayloadChange = useCallback(
    (payload: BroadcastPayload) => {
      setItem(payload.item)
      setVideoTransition(
        payload.item?.kind === "video"
          ? videoTransitionClass(payload.transition?.type)
          : "",
      )
    },
    [],
  )

  useBroadcastOutputRuntime({
    canvas,
    outputId,
    onPayloadChange: handlePayloadChange,
  })
  useBroadcastVideo({ video: videoElement, item: videoItem, outputId })
  useBroadcastYoutube(youtubeFrame, isYoutube)

  useEffect(() => {
    // Accent is pinned to gold, so a one-time apply is enough — there is no
    // stored accent choice to watch for anymore.
    applyAccentThemeToDocument()
  }, [])

  return (
    <>
      <canvas
        ref={setCanvas}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          display: "block",
          background: "#000",
          objectFit: "contain",
        }}
      />
      <video
        key={`video-${videoItem?.video?.videoId ?? "none"}`}
        ref={setVideoElement}
        className={videoTransition}
        playsInline
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          display: videoItem && !isYoutube ? "block" : "none",
          background: "#000",
          objectFit: "contain",
          zIndex: 2,
        }}
      />
      <iframe
        key={`youtube-${videoItem?.video?.videoId ?? "none"}`}
        ref={setYoutubeFrame}
        className={videoTransition}
        title={videoItem?.reference ?? "YouTube video"}
        src={isYoutube && youtubeSrc ? youtubeSrc : undefined}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          display: isYoutube ? "block" : "none",
          background: "#000",
          border: 0,
          zIndex: 2,
        }}
      />
    </>
  )
}

applyAccentThemeToDocument()

const root = document.getElementById("broadcast-root")!
createRoot(root).render(<BroadcastCanvas />)
