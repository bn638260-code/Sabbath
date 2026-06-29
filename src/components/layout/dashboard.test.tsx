// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"
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
  TranscriptPanel: () => <div data-slot="transcript-panel" />,
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

vi.mock("@/components/panels/search-panel", () => ({
  SearchPanel: () => <div data-slot="search-panel" />,
}))

beforeEach(() => {
  useDashboardWorkspaceStore.setState({ workspace: "live" })
  useServicePlanStore.setState({ plannerOpen: false })
  useAccentThemeStore.setState({ theme: "teal" })
  Element.prototype.scrollTo = vi.fn()
})

afterEach(() => cleanup())

describe("Dashboard workspace routing", () => {
  it("Live Desk renders the latest-detection bar without SearchPanel or DetectionsPanel", () => {
    render(<Dashboard />)

    expect(document.querySelector('[data-slot="latest-detection-bar"]')).toBeTruthy()
    expect(document.querySelector('[data-slot="search-panel"]')).toBeNull()
    expect(document.querySelector('[data-slot="detections-panel"]')).toBeNull()
    expect(document.querySelector('[data-slot="queue-panel"]')).toBeTruthy()
  })

  it("Detections workspace renders DetectionsPanel", () => {
    useDashboardWorkspaceStore.setState({ workspace: "detections" })
    render(<Dashboard />)

    expect(document.querySelector('[data-slot="detections-panel"]')).toBeTruthy()
    expect(document.querySelector('[data-slot="latest-detection-bar"]')).toBeNull()
  })

  it("Scripture and EGW workspace renders SearchPanel", () => {
    useDashboardWorkspaceStore.setState({ workspace: "scripture-search" })
    render(<Dashboard />)

    expect(document.querySelector('[data-slot="search-panel"]')).toBeTruthy()
    expect(document.querySelector('[data-slot="latest-detection-bar"]')).toBeNull()
  })
})
