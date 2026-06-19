import { describe, expect, it } from "vitest"
import {
  DASHBOARD_WORKSPACE_NAV,
  workspaceNavLabel,
} from "./dashboard-workspace-nav"
import type { DashboardWorkspace } from "@/stores/dashboard-workspace-store"

const EXPECTED_IDS: DashboardWorkspace[] = [
  "live",
  "queue",
  "run-service",
  "service-plans",
  "live-service",
  "hymns",
  "library",
  "settings",
  "help-legal",
]

describe("dashboard-workspace-nav", () => {
  it("lists all workspaces in reference order", () => {
    expect(DASHBOARD_WORKSPACE_NAV.map((item) => item.id)).toEqual(EXPECTED_IDS)
  })

  it("uses top navigation with dividers before media and settings", () => {
    const withDivider = DASHBOARD_WORKSPACE_NAV.filter((i) => i.dividerBefore)
    expect(withDivider.map((i) => i.id)).toEqual(["hymns", "settings"])
  })

  it("exposes shortcut metadata for the workspaces that have keyboard shortcuts", () => {
    const shortcuts = Object.fromEntries(
      DASHBOARD_WORKSPACE_NAV.map((item) => [item.id, item.shortcut]),
    )
    expect(shortcuts.live).toBe("Ctrl/Cmd + 1")
    expect(shortcuts["service-plans"]).toBe("Ctrl/Cmd + 2")
    expect(shortcuts["run-service"]).toBe("Ctrl/Cmd + 3")
    expect(shortcuts.hymns).toBe("Ctrl/Cmd + 4")
    expect(shortcuts.library).toBe("Ctrl/Cmd + 5")
    expect(shortcuts.queue).toBe("Ctrl/Cmd + 6")
    expect(shortcuts["live-service"]).toBeUndefined()
    expect(shortcuts.settings).toBeUndefined()
    expect(shortcuts["help-legal"]).toBeUndefined()
  })

  it("opens planner only for service schedules", () => {
    const plannerItems = DASHBOARD_WORKSPACE_NAV.filter(
      (item) => item.opensPlanner,
    )
    expect(plannerItems).toHaveLength(1)
    expect(plannerItems[0]?.id).toBe("service-plans")
  })

  it("resolves labels for each workspace id", () => {
    for (const id of EXPECTED_IDS) {
      expect(workspaceNavLabel(id)).toBeTruthy()
    }
    expect(workspaceNavLabel("live")).toBe("Live Desk")
    expect(workspaceNavLabel("queue")).toBe("Queue")
    expect(workspaceNavLabel("live-service")).toBe("Broadcast Control")
    expect(workspaceNavLabel("settings")).toBe("System Settings")
    expect(workspaceNavLabel("help-legal")).toBe("Help & Legal")
  })
})
