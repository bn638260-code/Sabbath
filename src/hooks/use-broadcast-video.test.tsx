// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useBroadcastVideo } from "./use-broadcast-video"
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
    listen: vi.fn((event: string, callback: typeof videoListenerRef.current) => {
      if (event === "broadcast:video-control") videoListenerRef.current = callback
      return Promise.resolve(() => {
        videoListenerRef.current = null
      })
    }),
  }),
}))

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn().mockResolvedValue(undefined),
}))

function TestBroadcastVideo({ video }: { video: HTMLVideoElement }) {
  useBroadcastVideo({ video, item: null, outputId: "main" })
  return null
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
})
