// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useBroadcastVideo } from "./use-broadcast-video"
import type { PresentationRenderData } from "@/types"
import type { VideoTransportCommand } from "@/lib/broadcast-video-control"

const { videoListenerRef } = vi.hoisted(() => ({
  videoListenerRef: {
    current: null as
      | ((event: { payload: VideoTransportCommand }) => void)
      | null,
  },
}))

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({
    listen: vi.fn(
      (event: string, callback: typeof videoListenerRef.current) => {
        if (event === "broadcast:video-control")
          videoListenerRef.current = callback
        return Promise.resolve(() => {
          videoListenerRef.current = null
        })
      }
    ),
  }),
}))

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn().mockResolvedValue(undefined),
}))

function TestBroadcastVideo({ video }: { video: HTMLVideoElement }) {
  useBroadcastVideo({ video, item: null, outputId: "main" })
  return null
}

function TestBroadcastVideoWithItem({
  video,
  item,
}: {
  video: HTMLVideoElement
  item: PresentationRenderData | null
}) {
  useBroadcastVideo({ video, item, outputId: "operator" })
  return null
}

const videoItem: PresentationRenderData = {
  kind: "video",
  reference: "Welcome Video",
  segments: [{ text: "Welcome Video" }],
  video: {
    source: "url",
    videoId: "video-1",
    title: "Welcome Video",
    url: "https://cdn.example.com/welcome.mp4",
  },
}

describe("useBroadcastVideo", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    videoListenerRef.current = null
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it("applies audio sink commands even before item state catches up", async () => {
    const video = document.createElement("video") as HTMLVideoElement & {
      setSinkId: (sinkId: string) => Promise<void>
    }
    const setSinkId = vi.fn().mockResolvedValue(undefined)
    Object.defineProperties(video, {
      load: { value: vi.fn() },
      pause: { value: vi.fn() },
      play: { value: vi.fn().mockResolvedValue(undefined) },
    })
    video.setSinkId = setSinkId

    await act(async () => {
      root.render(<TestBroadcastVideo video={video} />)
    })
    await vi.waitFor(() => expect(videoListenerRef.current).not.toBeNull())

    await act(async () => {
      videoListenerRef.current?.({
        payload: { type: "setSinkId", sinkId: "speaker-1" },
      })
    })

    expect(setSinkId).toHaveBeenCalledWith("speaker-1")
  })

  it("does not require mocked play to return a promise", async () => {
    const video = document.createElement("video")
    const play = vi.fn()
    Object.defineProperties(video, {
      load: { value: vi.fn() },
      pause: { value: vi.fn() },
      play: { value: play },
    })

    await act(async () => {
      root.render(
        <TestBroadcastVideoWithItem
          video={video}
          item={videoItem}
        />
      )
    })

    expect(play).toHaveBeenCalled()
  })

  it("rewinds before replaying an ended video", async () => {
    const video = document.createElement("video")
    const play = vi.fn().mockResolvedValue(undefined)
    Object.defineProperties(video, {
      duration: { value: 10 },
      load: { value: vi.fn() },
      pause: { value: vi.fn() },
      play: { value: play },
    })

    await act(async () => {
      root.render(<TestBroadcastVideoWithItem video={video} item={videoItem} />)
    })
    await vi.waitFor(() => expect(videoListenerRef.current).not.toBeNull())

    video.currentTime = 10
    await act(async () => {
      videoListenerRef.current?.({ payload: { type: "play" } })
    })

    expect(video.currentTime).toBe(0)
    expect(play).toHaveBeenCalled()
  })

  it("restarts when the same source is loaded again", async () => {
    const video = document.createElement("video")
    const play = vi.fn().mockResolvedValue(undefined)
    Object.defineProperties(video, {
      load: { value: vi.fn() },
      pause: { value: vi.fn() },
      play: { value: play },
    })

    await act(async () => {
      root.render(<TestBroadcastVideo video={video} />)
    })
    await vi.waitFor(() => expect(videoListenerRef.current).not.toBeNull())

    await act(async () => {
      videoListenerRef.current?.({ payload: { type: "load", item: videoItem } })
    })
    video.currentTime = 7
    await act(async () => {
      videoListenerRef.current?.({ payload: { type: "load", item: videoItem } })
    })

    expect(video.currentTime).toBe(0)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it("stops stale video even after item state has cleared", async () => {
    const video = document.createElement("video")
    const load = vi.fn()
    const pause = vi.fn()
    Object.defineProperties(video, {
      load: { value: load },
      pause: { value: pause },
      play: { value: vi.fn().mockResolvedValue(undefined) },
    })
    video.src = "https://cdn.example.com/welcome.mp4"

    await act(async () => {
      root.render(<TestBroadcastVideo video={video} />)
    })
    await vi.waitFor(() => expect(videoListenerRef.current).not.toBeNull())

    await act(async () => {
      videoListenerRef.current?.({ payload: { type: "stop" } })
    })

    expect(pause).toHaveBeenCalled()
    expect(load).toHaveBeenCalled()
    expect(video.getAttribute("src")).toBeNull()
  })

  it("unloads an ended native video when a non-video item replaces it", async () => {
    const video = document.createElement("video")
    const load = vi.fn()
    const pause = vi.fn()
    Object.defineProperties(video, {
      duration: { value: 10 },
      load: { value: load },
      pause: { value: pause },
      play: { value: vi.fn().mockResolvedValue(undefined) },
    })
    const nextItem: PresentationRenderData = {
      kind: "scripture",
      reference: "John 3:16",
      segments: [{ text: "For God so loved the world", verseNumber: 16 }],
    }

    await act(async () => {
      root.render(<TestBroadcastVideoWithItem video={video} item={videoItem} />)
    })

    video.currentTime = 10
    pause.mockClear()
    load.mockClear()

    await act(async () => {
      root.render(<TestBroadcastVideoWithItem video={video} item={nextItem} />)
    })

    expect(pause).toHaveBeenCalled()
    expect(load).toHaveBeenCalled()
    expect(video.getAttribute("src")).toBeNull()
  })
})
