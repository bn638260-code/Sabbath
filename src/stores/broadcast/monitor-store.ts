import { useBroadcastStore, type BroadcastState } from "@/stores/broadcast-store"

export type BroadcastMonitorState = Pick<
  BroadcastState,
  | "mainDisplayMonitorIndex"
  | "altDisplayMonitorIndex"
  | "mainDisplayMonitorKey"
  | "altDisplayMonitorKey"
  | "mainProjectorFullscreen"
  | "altProjectorFullscreen"
  | "setMainDisplayMonitorIndex"
  | "setAltDisplayMonitorIndex"
  | "setMainDisplayMonitorKey"
  | "setAltDisplayMonitorKey"
  | "setMainProjectorFullscreen"
  | "setAltProjectorFullscreen"
>

type BroadcastMonitorHook = {
  <T>(selector: (state: BroadcastMonitorState) => T): T
  getState: () => BroadcastMonitorState
}

export const useBroadcastMonitorStore =
  useBroadcastStore as unknown as BroadcastMonitorHook

export function getBroadcastMonitorStore(): BroadcastMonitorState {
  return useBroadcastMonitorStore.getState()
}
