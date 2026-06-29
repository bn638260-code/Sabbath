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

export const useBroadcastRemoteControlStore =
  useBroadcastStore as unknown as BroadcastRemoteControlHook
