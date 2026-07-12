// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { WorkspaceTopNav } from "./workspace-top-nav"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import { useServicePlanStore } from "@/stores/service-plan-store"

function renderTopNav() {
  return render(
    <TooltipProvider>
      <WorkspaceTopNav />
    </TooltipProvider>
  )
}

beforeEach(() => {
  useDashboardWorkspaceStore.setState({ workspace: "live" })
  useServicePlanStore.setState({ plannerOpen: false })
})

afterEach(() => {
  cleanup()
})

describe("WorkspaceTopNav", () => {
  it("renders an accessible workspace navigation with a labelled button per workspace", () => {
    renderTopNav()
    const nav = screen.getByRole("navigation", { name: "Workspaces" })
    expect(nav).toBeTruthy()
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(12)
    for (const button of buttons) {
      expect(button.getAttribute("aria-label")).toBeTruthy()
    }
  })

  it("switches to the same workspace the icon represents", () => {
    renderTopNav()
    fireEvent.click(screen.getByRole("button", { name: /Broadcast Control/ }))
    expect(useDashboardWorkspaceStore.getState().workspace).toBe("live-service")
  })

  it("opens the planner when Service Schedules is selected", () => {
    renderTopNav()
    fireEvent.click(screen.getByRole("button", { name: /Service Schedules/ }))
    expect(useDashboardWorkspaceStore.getState().workspace).toBe(
      "service-plans"
    )
    expect(useServicePlanStore.getState().plannerOpen).toBe(true)
  })

  it("closes the planner when a non-planner workspace is selected", () => {
    useServicePlanStore.setState({ plannerOpen: true })
    renderTopNav()
    fireEvent.click(screen.getByRole("button", { name: /SDA Hymns Search/ }))
    expect(useDashboardWorkspaceStore.getState().workspace).toBe("hymns")
    expect(useServicePlanStore.getState().plannerOpen).toBe(false)
  })

  it("switches to the Library workspace", () => {
    renderTopNav()
    fireEvent.click(screen.getByRole("button", { name: /Church Library/ }))
    expect(useDashboardWorkspaceStore.getState().workspace).toBe("library")
  })

  it("switches to the Themes workspace", () => {
    renderTopNav()
    fireEvent.click(screen.getByRole("button", { name: /^Themes/ }))
    expect(useDashboardWorkspaceStore.getState().workspace).toBe(
      "kinetic-themes"
    )
  })

  it("switches to the Queue workspace", () => {
    renderTopNav()
    fireEvent.click(screen.getByRole("button", { name: /Queue/ }))
    expect(useDashboardWorkspaceStore.getState().workspace).toBe("queue")
  })

  it("marks the active workspace icon with aria-current", () => {
    useDashboardWorkspaceStore.setState({ workspace: "settings" })
    renderTopNav()
    const active = screen.getByRole("button", { name: /System Settings/ })
    expect(active.getAttribute("aria-current")).toBe("page")
    const inactive = screen.getByRole("button", { name: /Live Desk/ })
    expect(inactive.getAttribute("aria-current")).toBeNull()
  })

  it("exposes broadcast, themes, and settings tutorial anchors", () => {
    renderTopNav()
    expect(
      screen
        .getByRole("button", { name: /Broadcast Control/ })
        .getAttribute("data-tour")
    ).toBe("broadcast")
    expect(
      screen.getByRole("button", { name: /^Themes/ }).getAttribute("data-tour")
    ).toBe("kinetic-themes")
    expect(
      screen
        .getByRole("button", { name: /System Settings/ })
        .getAttribute("data-tour")
    ).toBe("settings")
  })
})
