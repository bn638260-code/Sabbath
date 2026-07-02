// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TranscriptPanel, isNearTranscriptBottom } from "./transcript-panel"
import { useTranscriptStore } from "@/stores/transcript-store"
import type { TranscriptSegment } from "@/types"

const startTranscriptionMock = vi.fn()
const stopTranscriptionMock = vi.fn()
const dumpTranscriptMemoryMock = vi.fn()

const transcriptionState: {
  segments: TranscriptSegment[]
  isTranscribing: boolean
  connectionStatus: "disconnected" | "connecting" | "connected" | "error"
} = {
  segments: [],
  isTranscribing: false,
  connectionStatus: "disconnected",
}

vi.mock("@/hooks/use-transcription", () => ({
  useTranscription: () => ({
    segments: transcriptionState.segments,
    isTranscribing: transcriptionState.isTranscribing,
    connectionStatus: transcriptionState.connectionStatus,
    startTranscription: startTranscriptionMock,
    stopTranscription: stopTranscriptionMock,
    dumpTranscriptMemory: dumpTranscriptMemoryMock,
  }),
}))

vi.mock("@/components/ui/api-key-prompt", () => ({
  ApiKeyPrompt: () => null,
}))

function segment(id: string, text: string): TranscriptSegment {
  return {
    id,
    text,
    is_final: true,
    confidence: 0.95,
    words: [],
    timestamp: Date.now(),
  }
}

function setScrollMetrics(
  node: HTMLElement,
  metrics: { scrollHeight: number; clientHeight: number; scrollTop: number }
) {
  Object.defineProperty(node, "scrollHeight", {
    configurable: true,
    value: metrics.scrollHeight,
  })
  Object.defineProperty(node, "clientHeight", {
    configurable: true,
    value: metrics.clientHeight,
  })
  node.scrollTop = metrics.scrollTop
}

function transcriptScroll(container: HTMLElement) {
  const node = container.querySelector('[data-slot="transcript-scroll"]')
  expect(node).toBeInstanceOf(HTMLElement)
  return node as HTMLElement
}

describe("TranscriptPanel", () => {
  beforeEach(() => {
    startTranscriptionMock.mockReset()
    stopTranscriptionMock.mockReset()
    dumpTranscriptMemoryMock.mockReset()
    transcriptionState.segments = []
    transcriptionState.isTranscribing = false
    transcriptionState.connectionStatus = "disconnected"
    useTranscriptStore.setState({
      segments: [],
      currentPartial: "",
      isTranscribing: false,
      connectionStatus: "disconnected",
      lastIssue: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("places the transcription controls before the scroll region", () => {
    const { container } = render(<TranscriptPanel />)
    const controls = container.querySelector('[data-slot="transcript-controls"]')
    const scroll = transcriptScroll(container)

    expect(controls).toBeInstanceOf(HTMLElement)
    expect(
      controls?.compareDocumentPosition(scroll) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /start transcribing/i }))
    expect(startTranscriptionMock).toHaveBeenCalledTimes(1)
  })

  it("auto-scrolls when the transcript was already near the bottom", () => {
    transcriptionState.segments = [segment("seg-1", "first line")]
    const { container, rerender } = render(<TranscriptPanel />)
    const scroll = transcriptScroll(container)

    setScrollMetrics(scroll, {
      scrollHeight: 200,
      clientHeight: 100,
      scrollTop: 100,
    })
    fireEvent.scroll(scroll)

    setScrollMetrics(scroll, {
      scrollHeight: 300,
      clientHeight: 100,
      scrollTop: 100,
    })
    transcriptionState.segments = [
      ...transcriptionState.segments,
      segment("seg-2", "second line"),
    ]
    rerender(<TranscriptPanel />)

    expect(scroll.scrollTop).toBe(300)
    expect(screen.queryByRole("button", { name: /jump to latest/i })).toBeNull()
  })

  it("preserves scroll position and offers jump-to-latest when scrolled up", () => {
    transcriptionState.segments = [segment("seg-1", "first line")]
    const { container, rerender } = render(<TranscriptPanel />)
    const scroll = transcriptScroll(container)

    setScrollMetrics(scroll, {
      scrollHeight: 200,
      clientHeight: 100,
      scrollTop: 20,
    })
    fireEvent.scroll(scroll)

    setScrollMetrics(scroll, {
      scrollHeight: 300,
      clientHeight: 100,
      scrollTop: 20,
    })
    transcriptionState.segments = [
      ...transcriptionState.segments,
      segment("seg-2", "second line"),
    ]
    rerender(<TranscriptPanel />)

    expect(scroll.scrollTop).toBe(20)

    fireEvent.click(screen.getByRole("button", { name: /jump to latest/i }))

    expect(scroll.scrollTop).toBe(300)
    expect(screen.queryByRole("button", { name: /jump to latest/i })).toBeNull()
  })

  it("uses a 40px threshold for stick-to-bottom detection", () => {
    expect(
      isNearTranscriptBottom({
        scrollHeight: 200,
        clientHeight: 100,
        scrollTop: 60,
      })
    ).toBe(true)
    expect(
      isNearTranscriptBottom({
        scrollHeight: 200,
        clientHeight: 100,
        scrollTop: 59,
      })
    ).toBe(false)
  })
})
