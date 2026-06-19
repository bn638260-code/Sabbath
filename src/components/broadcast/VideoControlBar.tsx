import { useEffect, useMemo, useState } from "react"
import { listen } from "@tauri-apps/api/event"
import {
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  canSetAudioSink,
  listAudioOutputDevices,
  type AudioOutputDevice,
} from "@/lib/audio-output-devices"
import { VIDEO_TIMEUPDATE_EVENT } from "@/lib/library/library-video"
import type { VideoTimeUpdatePayload } from "@/lib/broadcast-video-control"
import { useBroadcastStore } from "@/stores/broadcast-store"
import type { PresentationRenderData } from "@/types"

interface VideoControlBarProps {
  item: PresentationRenderData
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00"
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, "0")}`
}

function isVideoSourceMissing(item: PresentationRenderData): boolean {
  const video = item.video
  if (!video) return true
  if (video.source === "local") return !video.videoPath
  if (video.source === "url") return !video.url
  return !video.youtubeId
}

function VideoTransportButtons({ paused, muted }: { paused: boolean; muted: boolean }) {
  return (
    <>
      <Button
        type="button"
        size="icon-xs"
        variant="outline"
        title={paused ? "Play video" : "Pause video"}
        onClick={() =>
          useBroadcastStore
            .getState()
            .sendVideoCommand({ type: paused ? "play" : "pause" })
        }
      >
        {paused ? <PlayIcon className="size-3" /> : <PauseIcon className="size-3" />}
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="outline"
        title="Restart video"
        onClick={() => useBroadcastStore.getState().sendVideoCommand({ type: "restart" })}
      >
        <RotateCcwIcon className="size-3" />
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="outline"
        title={muted ? "Unmute video" : "Mute video"}
        onClick={() => useBroadcastStore.getState().setVideoMuted(!muted)}
      >
        {muted ? <VolumeXIcon className="size-3" /> : <Volume2Icon className="size-3" />}
      </Button>
    </>
  )
}

function VideoSliders({
  isYoutube,
  duration,
  currentTime,
  volume,
}: {
  isYoutube: boolean
  duration: number
  currentTime: number
  volume: number
}) {
  const durationMax = Math.max(duration, 1)
  return (
    <>
      <input
        type="range"
        min={0}
        max={durationMax}
        step={0.1}
        value={Math.min(currentTime, durationMax)}
        disabled={isYoutube}
        aria-label="Video position"
        className="h-2 min-w-40 flex-1 accent-primary"
        onChange={(event) =>
          useBroadcastStore.getState().sendVideoCommand({
            type: "seek",
            currentTime: Number(event.currentTarget.value),
          })
        }
      />
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        disabled={isYoutube}
        aria-label="Video volume"
        className="h-2 w-20 accent-primary"
        onChange={(event) =>
          useBroadcastStore.getState().setVideoVolume(Number(event.currentTarget.value))
        }
      />
    </>
  )
}

function VideoOptions({
  isYoutube,
  loop,
  autoAdvance,
}: {
  isYoutube: boolean
  loop: boolean
  autoAdvance: boolean
}) {
  return (
    <>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={loop}
          disabled={isYoutube}
          onChange={(event) =>
            useBroadcastStore.getState().setVideoLoop(event.currentTarget.checked)
          }
        />
        Loop
      </label>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={autoAdvance}
          onChange={(event) =>
            useBroadcastStore
              .getState()
              .setAutoAdvanceVideoOnEnd(event.currentTarget.checked)
          }
        />
        Auto-advance
      </label>
    </>
  )
}

function AudioDeviceSelect({
  preferredDevice,
  canRouteAudio,
  devices,
}: {
  preferredDevice: string
  canRouteAudio: boolean
  devices: AudioOutputDevice[]
}) {
  return (
    <select
      value={preferredDevice}
      disabled={!canRouteAudio || devices.length === 0}
      className="search-input h-8 max-w-40 px-2 text-xs"
      aria-label="Audio output device"
      onChange={(event) =>
        useBroadcastStore
          .getState()
          .setPreferredAudioOutputDeviceId(event.currentTarget.value)
      }
    >
      <option value="">Default audio</option>
      {devices.map((device) => (
        <option key={device.deviceId} value={device.deviceId}>
          {device.label}
        </option>
      ))}
    </select>
  )
}

export function VideoControlBar({ item }: VideoControlBarProps) {
  const transport = useBroadcastStore((state) => state.videoTransport)
  const muted = useBroadcastStore((state) => state.videoMuted)
  const volume = useBroadcastStore((state) => state.videoVolume)
  const loop = useBroadcastStore((state) => state.videoLoop)
  const autoAdvance = useBroadcastStore((state) => state.autoAdvanceVideoOnEnd)
  const preferredDevice = useBroadcastStore((state) => state.preferredAudioOutputDeviceId)
  const [devices, setDevices] = useState<AudioOutputDevice[]>([])

  const isYoutube = item.video?.source === "youtube"
  const canRouteAudio = !isYoutube && canSetAudioSink()
  const duration = transport?.duration ?? (item.video?.durationMs ?? 0) / 1000
  const currentTime = transport?.currentTime ?? 0
  const paused = transport?.paused ?? false
  const sourceMissing = isVideoSourceMissing(item)

  const transportLabel = useMemo(
    () => `${formatTime(currentTime)} / ${formatTime(duration)}`,
    [currentTime, duration],
  )

  useEffect(() => {
    const unlisten = listen<VideoTimeUpdatePayload>(
      VIDEO_TIMEUPDATE_EVENT,
      (event) => {
        useBroadcastStore.getState().setVideoTransport(event.payload)
        if (event.payload.ended) {
          useBroadcastStore.getState().handleVideoEnded()
        }
      },
    )
    return () => {
      void unlisten.then((fn) => fn())
    }
  }, [])

  useEffect(() => {
    if (!canRouteAudio) return
    void listAudioOutputDevices().then(setDevices)
  }, [canRouteAudio])

  if (sourceMissing) {
    return (
      <div className="flex min-h-10 items-center border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-destructive">
        Video source missing
      </div>
    )
  }

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-muted-foreground">
      <VideoTransportButtons paused={paused} muted={muted} />
      <span className="w-20 shrink-0 tabular-nums">{transportLabel}</span>
      <VideoSliders
        isYoutube={isYoutube}
        duration={duration}
        currentTime={currentTime}
        volume={volume}
      />
      <VideoOptions
        isYoutube={isYoutube}
        loop={loop}
        autoAdvance={autoAdvance}
      />
      <AudioDeviceSelect
        preferredDevice={preferredDevice}
        canRouteAudio={canRouteAudio}
        devices={devices}
      />
      {isYoutube ? (
        <span className="text-[0.625rem] uppercase text-muted-foreground">
          YouTube limits scrub and device routing
        </span>
      ) : null}
    </div>
  )
}
