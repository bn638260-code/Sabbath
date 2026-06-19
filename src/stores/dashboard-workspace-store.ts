import { create } from "zustand"

export type DashboardWorkspace =
  | "live"
  | "queue"
  | "run-service"
  | "service-plans"
  | "hymns"
  | "library"
  | "live-service"
  | "settings"
  | "help-legal"

interface DashboardWorkspaceState {
  workspace: DashboardWorkspace
  setWorkspace: (workspace: DashboardWorkspace) => void
}

export const useDashboardWorkspaceStore = create<DashboardWorkspaceState>(
  (set) => ({
    workspace: "live",
    setWorkspace: (workspace) => set({ workspace }),
  })
)
