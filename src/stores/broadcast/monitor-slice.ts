import { type StateCreator } from "zustand"
import type { BroadcastState } from "@/stores/broadcast-store"

export interface MonitorSlice {
  mainDisplayMonitorIndex: number
  altDisplayMonitorIndex: number
  mainDisplayMonitorKey: string
  altDisplayMonitorKey: string
  mainProjectorFullscreen: boolean
  altProjectorFullscreen: boolean
  setMainDisplayMonitorIndex: (index: number) => void
  setAltDisplayMonitorIndex: (index: number) => void
  setMainDisplayMonitorKey: (key: string) => void
  setAltDisplayMonitorKey: (key: string) => void
  setMainProjectorFullscreen: (fullscreen: boolean) => void
  setAltProjectorFullscreen: (fullscreen: boolean) => void
}

export const createMonitorSlice: StateCreator<
  BroadcastState,
  [],
  [],
  MonitorSlice
> = (set) => ({
  mainDisplayMonitorIndex: 0,
  altDisplayMonitorIndex: 0,
  mainDisplayMonitorKey: "",
  altDisplayMonitorKey: "",
  mainProjectorFullscreen: false,
  altProjectorFullscreen: false,

  setMainDisplayMonitorIndex: (mainDisplayMonitorIndex) => {
    set({ mainDisplayMonitorIndex })
  },
  setAltDisplayMonitorIndex: (altDisplayMonitorIndex) => {
    set({ altDisplayMonitorIndex })
  },
  setMainDisplayMonitorKey: (mainDisplayMonitorKey) => {
    set({ mainDisplayMonitorKey })
  },
  setAltDisplayMonitorKey: (altDisplayMonitorKey) => {
    set({ altDisplayMonitorKey })
  },
  setMainProjectorFullscreen: (mainProjectorFullscreen) => {
    set({ mainProjectorFullscreen })
  },
  setAltProjectorFullscreen: (altProjectorFullscreen) => {
    set({ altProjectorFullscreen })
  },
})
