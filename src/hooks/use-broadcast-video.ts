import { useCallback, useEffect, useRef } from "react"
import { emitTo } from "@tauri-apps/api/event"
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import {
  buildVideoCommand,
  emitVideoTimeUpdate,
  type VideoTransportCommand,
} from "@/lib/broadcast-video-control"
import { VIDEO_TRANSPORT_EVENT } from "@/lib/library/library-video"
import { convertTauriFileSrc, isTauriRuntime } from "@/lib/tauri-runtime"
import type {
  BroadcastOutputId,
  PresentationRenderData,
  VideoPresentationSource,
} from "@/types"

interface UseBroadcastVideoOptions {
  video: HTMLVideoElement | null
  item: PresentationRenderData | null
  outputId: string
  onEnded?: () => void
}

function resolveNativeVideoSrc(video: VideoPresentationSource): string | null {
  if (video.source === "local" && video.videoPath) {
    return convertTauriFileSrc(video.videoPath)
  }
  if (video.source === "url" && video.url) return video.url
  return null
}

function snapshot(video: HTMLVideoElement, outputId: string, ended = false) {
  return {
    outputId,
    currentTime: video.currentTime || 0,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
    paused: video.paused,
    muted: video.muted,
    volume: video.volume,
    loop: video.loop,
    ended,
  }
}

function loadVideoSource(
  element: HTMLVideoElement,
  source: VideoPresentationSource | null | undefined,
): void {
  const src = source ? resolveNativeVideoSrc(source) : null
  if (!source || !src) {
    element.removeAttribute("src")
    element.load()
    return
  }
  if (element.src !== src) {
    element.src = src
    element.poster = source.poster ?? ""
    element.loop = Boolean(source.loop)
    element.load()
  }
  void element.play().catch(() => undefined)
}

function stopVideo(element: HTMLVideoElement): void {
  element.pause()
  element.removeAttribute("src")
  element.load()
}

function isBroadcastOutputId(outputId: string): outputId is BroadcastOutputId {
  return outputId === "main" || outputId === "alt"
}

function reportAudioSinkFailure(outputId: string, error: unknown): void {
  if (!isTauriRuntime() || !isBroadcastOutputId(outputId)) return
  void emitTo("main", "broadcast:output-error", {
    outputId,
    kind: "video-audio",
    title: "Video audio output failed",
    description: `Could not route video audio to the selected output: ${String(error)}`,
  })
}

function applyPlaybackCommand(
  element: HTMLVideoElement,
  payload: ReturnType<typeof buildVideoCommand>,
  outputId: string,
): void {
  if (payload.type === "play") void element.play().catch(() => undefined)
  if (payload.type === "pause") element.pause()
  if (payload.type === "restart") {
    element.currentTime = 0
    void element.play().catch(() => undefined)
  }
  if (payload.type === "seek") element.currentTime = payload.currentTime
  if (payload.type === "setVolume") element.volume = payload.volume
  if (payload.type === "setMuted") element.muted = payload.muted
  if (payload.type === "setLoop") element.loop = payload.loop
  if (payload.type === "setSinkId" && "setSinkId" in element) {
    void (element as HTMLVideoElement & { setSinkId: (sinkId: string) => Promise<void> })
      .setSinkId(payload.sinkId)
      .catch((error) => reportAudioSinkFailure(outputId, error))
  }
  if (payload.type === "stop") stopVideo(element)
}

function syncVideoItem(element: HTMLVideoElement, item: PresentationRenderData | null): void {
  const source = item?.video
  const src = source && source.source !== "youtube" ? resolveNativeVideoSrc(source) : null
  if (!source || !src) {
    stopVideo(element)
    return
  }
  if (element.src !== src) {
    element.src = src
    element.poster = source.poster ?? ""
    element.loop = Boolean(source.loop)
    element.load()
  }
  element.muted = false
  void element.play().catch(() => undefined)
}

export function useBroadcastVideo({
  video,
  item,
  outputId,
  onEnded,
}: UseBroadcastVideoOptions): void {
  const itemRef = useRef<PresentationRenderData | null>(item)
  const videoRef = useRef<HTMLVideoElement | null>(video)
  const lastTimeUpdateRef = useRef(0)
  const onEndedRef = useRef(onEnded)

  useEffect(() => {
    itemRef.current = item
  }, [item])

  useEffect(() => {
    videoRef.current = video
  }, [video])

  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

  const applyCommand = useCallback(
    (command: VideoTransportCommand) => {
      const element = videoRef.current
      if (!element) return
      const payload = buildVideoCommand(command)
      if (payload.type === "load") {
        loadVideoSource(element, payload.item.video)
        return
      }
      if (payload.type === "setSinkId") {
        applyPlaybackCommand(element, payload, outputId)
        return
      }
      if (!itemRef.current?.video || itemRef.current.video.source === "youtube") return
      applyPlaybackCommand(element, payload, outputId)
    },
    [outputId],
  )

  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    syncVideoItem(element, item)
  }, [item, video])

  useEffect(() => {
    if (!video) return
    if (!isTauriRuntime()) return
    const currentWindow = getCurrentWebviewWindow()
    const unlisten = currentWindow.listen<VideoTransportCommand>(
      VIDEO_TRANSPORT_EVENT,
      (event) => applyCommand(event.payload),
    )
    return () => {
      void unlisten.then((fn) => fn())
    }
  }, [applyCommand, video])

  useEffect(() => {
    if (!video) return
    const emitSnapshot = (ended = false) => {
      if (!isTauriRuntime()) return
      void emitVideoTimeUpdate(snapshot(video, outputId, ended))
    }
    const handleTimeUpdate = () => {
      const now = Date.now()
      if (now - lastTimeUpdateRef.current < 250) return
      lastTimeUpdateRef.current = now
      emitSnapshot(false)
    }
    const handleEnded = () => {
      emitSnapshot(true)
      onEndedRef.current?.()
    }
    const handleStateChange = () => emitSnapshot(false)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("play", handleStateChange)
    video.addEventListener("pause", handleStateChange)
    video.addEventListener("ended", handleEnded)
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("play", handleStateChange)
      video.removeEventListener("pause", handleStateChange)
      video.removeEventListener("ended", handleEnded)
    }
  }, [outputId, video])
}
