import { create } from "zustand"
import type { MonitorInfo } from "@/components/broadcast/broadcast-settings-wiring"

/**
 * Shared state for the guided Projector Setup flow: whether the panel is open,
 * and the current monitor list (kept fresh by {@link useMonitorWatcher} so both
 * the header status chip and the panel read the same source of truth).
 */
interface ProjectorSetupState {
  open: boolean
  monitors: MonitorInfo[]
  refreshing: boolean
  setOpen: (open: boolean) => void
  setMonitors: (monitors: MonitorInfo[]) => void
  setRefreshing: (refreshing: boolean) => void
}

export const useProjectorSetupStore = create<ProjectorSetupState>((set) => ({
  open: false,
  monitors: [],
  refreshing: false,
  setOpen: (open) => set({ open }),
  setMonitors: (monitors) => set({ monitors }),
  setRefreshing: (refreshing) => set({ refreshing }),
}))

export function openProjectorSetup(): void {
  useProjectorSetupStore.getState().setOpen(true)
}
