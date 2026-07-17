// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, waitFor } from "@testing-library/react"
import { Dashboard } from "./dashboard"
import { useAccentThemeStore } from "@/stores/accent-theme-store"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"

vi.mock("@/hooks/use-dashboard-keyboard-controls", () => ({
  useDashboardKeyboardControls: vi.fn(),
}))

vi.mock("@/components/layout/app-controller-header", () => ({
  AppControllerHeader: () => <div data-testid="app-header" />,
}))

vi.mock("@/components/layout/operator-status-strip", () => ({
  OperatorStatusStrip: () => null,
}))

vi.mock("@/components/panels/transcript-panel", () => ({
  TranscriptPanel: ({ className }: { className?: string }) => (
    <div data-slot="transcript-panel" className={className} />
  ),
}))

vi.mock("@/components/panels/preview-panel", () => ({
  PreviewPanel: () => <div data-slot="preview-panel" />,
}))

vi.mock("@/components/panels/live-output-panel", () => ({
  LiveOutputPanel: () => <div data-slot="live-output-panel" />,
}))

vi.mock("@/components/panels/queue-panel", () => ({
  QueuePanel: () => <div data-slot="queue-panel" />,
}))

vi.mock("@/components/panels/latest-detection-bar", () => ({
  LatestDetectionBar: () => <div data-slot="latest-detection-bar" />,
}))

vi.mock("@/components/panels/detections-panel", () => ({
  DetectionsPanel: () => <div data-slot="detections-panel" />,
}))

vi.mock("@/components/panels/collected-detections-panel", () => ({
  CollectedDetectionsPanel: ({ className }: { className?: string }) => (
    <div data-slot="collected-detections-panel" className={className} />
  ),
}))

vi.mock("@/components/panels/search-panel", () => ({
  SearchPanel: () => <div data-slot="search-panel" />,
}))

vi.mock("@/components/broadcast/KineticThemesPage", () => ({
  KineticThemesPage: () => <div data-slot="kinetic-themes-page" />,
}))

beforeEach(() => {
  useDashboardWorkspaceStore.setState({ workspace: "live" })
  useServicePlanStore.setState({ plannerOpen: false })
  useAccentThemeStore.setState({ theme: "gold" })
  Element.prototype.scrollTo = vi.fn()
})

afterEach(() => cleanup())

describe("Dashboard workspace routing", () => {
  it("Live Desk renders collected detections below the live cards", () => {
    render(<Dashboard />)

    expect(
      document.querySelector('[data-slot="latest-detection-bar"]')
    ).toBeTruthy()
    expect(document.querySelector('[data-slot="search-panel"]')).toBeNull()
    expect(document.querySelector('[data-slot="detections-panel"]')).toBeNull()
    expect(document.querySelector('[data-slot="queue-panel"]')).toBeTruthy()

    const transcript = document.querySelector('[data-slot="transcript-panel"]')!
    const latestDetection = document.querySelector(
      '[data-slot="latest-detection-bar"]'
    )!
    const queue = document.querySelector('[data-slot="queue-panel"]')!
    const collected = document.querySelector(
      '[data-slot="collected-detections-panel"]'
    )!

    expect(collected.getAttribute("class")).toContain("col-span-12")
    expect(
      transcript.compareDocumentPosition(collected) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      latestDetection.compareDocumentPosition(collected) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(
      queue.compareDocumentPosition(collected) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it("sizes the live transcript to reach the bottom live-desk row", () => {
    render(<Dashboard />)

    const transcript = document.querySelector('[data-slot="transcript-panel"]')
    expect(transcript?.getAttribute("class")).toContain(
      "h-[calc(clamp(360px,47vh,560px)+clamp(240px,31vh,380px)+0.75rem)]"
    )
  })

  it("Detections workspace renders DetectionsPanel without collected detections", () => {
    useDashboardWorkspaceStore.setState({ workspace: "detections" })
    render(<Dashboard />)

    expect(
      document.querySelector('[data-slot="detections-panel"]')
    ).toBeTruthy()
    expect(
      document.querySelector('[data-slot="latest-detection-bar"]')
    ).toBeNull()
    expect(
      document.querySelector('[data-slot="collected-detections-panel"]')
    ).toBeNull()
  })

  it("Scripture and EGW workspace renders SearchPanel", () => {
    useDashboardWorkspaceStore.setState({ workspace: "scripture-search" })
    render(<Dashboard />)

    expect(document.querySelector('[data-slot="search-panel"]')).toBeTruthy()
    expect(
      document.querySelector('[data-slot="latest-detection-bar"]')
    ).toBeNull()
  })

  it("Themes workspace renders the dedicated theme page", async () => {
    useDashboardWorkspaceStore.setState({ workspace: "kinetic-themes" })
    render(<Dashboard />)

    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="kinetic-themes-page"]')
      ).toBeTruthy()
    )
    expect(
      document.querySelector('[data-slot="latest-detection-bar"]')
    ).toBeNull()
  })
})
