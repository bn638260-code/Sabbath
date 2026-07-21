import { useBroadcastStore, type BroadcastState } from "@/stores/broadcast-store"

export type BroadcastRemoteControlState = Pick<
  BroadcastState,
  | "themes"
  | "activeThemeId"
  | "isLive"
  | "liveItem"
  | "setActiveTheme"
  | "setOpacity"
  | "setLive"
>

type BroadcastRemoteControlHook = {
  getState: () => BroadcastRemoteControlState
}

// Reference useBroadcastStore lazily (at call time) rather than capturing it at
// module-init, so this view can't freeze to `undefined` if it is ever evaluated
// while broadcast-store is mid-initialization inside an import cycle. See
// output-issue-store.ts for the full rationale.
export const useBroadcastRemoteControlStore = {
  getState: (): BroadcastRemoteControlState => useBroadcastStore.getState(),
} as unknown as BroadcastRemoteControlHook
