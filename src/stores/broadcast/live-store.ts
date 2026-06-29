import type { BroadcastTheme, PresentationRenderData } from "@/types"
import {
  useBroadcastStore,
  useItemTheme,
  type BroadcastState,
} from "@/stores/broadcast-store"

export type BroadcastLiveState = Pick<
  BroadcastState,
  | "isLive"
  | "previewItem"
  | "liveItem"
  | "readingModeAutoLive"
  | "liveTransitionType"
  | "opacity"
  | "setLive"
  | "setPreviewItem"
  | "setLiveItem"
  | "commitLiveItem"
  | "setReadingModeAutoLive"
  | "setLiveTransitionType"
  | "setOpacity"
  | "syncBroadcastOutput"
  | "syncBroadcastOutputFor"
>

export type BroadcastLiveItem = BroadcastLiveState["liveItem"]

type BroadcastLiveHook = {
  <T>(selector: (state: BroadcastLiveState) => T): T
  getState: () => BroadcastLiveState
}

export const useBroadcastLiveStore =
  useBroadcastStore as unknown as BroadcastLiveHook

export function getBroadcastLiveStore(): BroadcastLiveState {
  return useBroadcastLiveStore.getState()
}

export function useLiveItemTheme(
  item: PresentationRenderData | null
): BroadcastTheme | null {
  return useItemTheme(item)
}
