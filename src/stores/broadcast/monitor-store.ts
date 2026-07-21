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

// Reference useBroadcastStore lazily (at call time) rather than capturing it at
// module-init, so this view can't freeze to `undefined` if it is ever evaluated
// while broadcast-store is mid-initialization inside an import cycle. See
// output-issue-store.ts for the full rationale.
export const useBroadcastMonitorStore = Object.assign(
  <T>(selector: (state: BroadcastMonitorState) => T): T =>
    (useBroadcastStore as unknown as BroadcastMonitorHook)(selector),
  {
    getState: (): BroadcastMonitorState => useBroadcastStore.getState(),
  }
) as unknown as BroadcastMonitorHook

export function getBroadcastMonitorStore(): BroadcastMonitorState {
  return useBroadcastMonitorStore.getState()
}
