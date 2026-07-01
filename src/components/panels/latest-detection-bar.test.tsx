// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { DetectionResult } from "@/types"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"

const { detectionsRef, previewMock, clearDetectionsMock } = vi.hoisted(() => ({
  detectionsRef: { current: [] as DetectionResult[] },
  previewMock: vi.fn(),
  clearDetectionsMock: vi.fn(),
}))

vi.mock("@/hooks/use-detection", () => ({
  useDetection: () => ({ detections: detectionsRef.current }),
  detectionActions: { clearDetections: clearDetectionsMock },
}))

// Isolate the bar from detection action internals (workflow / queue stores).
vi.mock("@/components/panels/detections-panel", () => ({
  getDetectionActions: () => ({
    preview: previewMock,
    present: vi.fn(),
    queue: vi.fn(),
  }),
  SourceBadge: ({ source }: { source: string }) => <span>{source}</span>,
}))

import { LatestDetectionBar } from "./latest-detection-bar"

const detection: DetectionResult = {
  verse_ref: "John 3:16",
  verse_text: "For God so loved the world.",
  book_name: "John",
  book_number: 43,
  chapter: 3,
  verse: 16,
  confidence: 0.96,
  source: "direct",
  auto_queued: false,
  transcript_snippet: "",
  is_chapter_only: false,
}

function makeDetection(reference: string, verse: number): DetectionResult {
  return {
    ...detection,
    verse_ref: reference,
    verse,
    verse_text: `Verse text for ${reference}.`,
  }
}

beforeEach(() => {
  detectionsRef.current = []
  previewMock.mockClear()
  clearDetectionsMock.mockClear()
  useDashboardWorkspaceStore.setState({ workspace: "live" })
})
afterEach(() => cleanup())

describe("LatestDetectionBar", () => {
  it("shows an empty state with no detections", () => {
    render(<LatestDetectionBar />)
    expect(screen.getByText(/no detections yet/i)).toBeTruthy()
  })

  it("renders the most recent detection reference", () => {
    detectionsRef.current = [detection]
    render(<LatestDetectionBar />)
    expect(screen.getByText("John 3:16")).toBeTruthy()
  })

  it("previews the latest detection from the quick action", () => {
    detectionsRef.current = [detection]
    render(<LatestDetectionBar />)
    fireEvent.click(screen.getByRole("button", { name: /preview john 3:16/i }))
    expect(previewMock).toHaveBeenCalledTimes(1)
  })

  it("shows the latest five detections on the live desk", () => {
    detectionsRef.current = [
      makeDetection("John 3:16", 16),
      makeDetection("John 3:17", 17),
      makeDetection("John 3:18", 18),
      makeDetection("John 3:19", 19),
      makeDetection("John 3:20", 20),
      makeDetection("John 3:21", 21),
    ]

    render(<LatestDetectionBar />)

    expect(screen.getByText("John 3:16")).toBeTruthy()
    expect(screen.getByText("John 3:20")).toBeTruthy()
    expect(screen.queryByText("John 3:21")).toBeNull()
  })

  it("navigates to the Detections page from the link", () => {
    render(<LatestDetectionBar />)
    fireEvent.click(screen.getByRole("button", { name: /open detections/i }))
    expect(useDashboardWorkspaceStore.getState().workspace).toBe("detections")
  })

  it("clears detections from the live bar", () => {
    detectionsRef.current = [detection]
    render(<LatestDetectionBar />)
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }))
    expect(clearDetectionsMock).toHaveBeenCalledTimes(1)
  })

  it("hides the clear button when there are no detections", () => {
    render(<LatestDetectionBar />)
    expect(screen.queryByRole("button", { name: /^clear$/i })).toBeNull()
  })
})
