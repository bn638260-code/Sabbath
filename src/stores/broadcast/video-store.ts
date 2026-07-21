import {
  decideVideoEndAction,
  useBroadcastStore,
  type BroadcastState,
  type VideoEndDecision,
} from "@/stores/broadcast-store"

export type BroadcastVideoState = Pick<
  BroadcastState,
  | "videoTransport"
  | "videoLoop"
  | "videoMuted"
  | "videoVolume"
  | "autoAdvanceVideoOnEnd"
  | "preferredAudioOutputDeviceId"
  | "sendVideoCommand"
  | "setVideoTransport"
  | "setVideoLoop"
  | "setVideoMuted"
  | "setVideoVolume"
  | "setPreferredAudioOutputDeviceId"
  | "setAutoAdvanceVideoOnEnd"
  | "handleVideoEnded"
>

type BroadcastVideoHook = {
  <T>(selector: (state: BroadcastVideoState) => T): T
  getState: () => BroadcastVideoState
}

// Reference useBroadcastStore lazily (at call time) rather than capturing it at
// module-init, so this view can't freeze to `undefined` if it is ever evaluated
// while broadcast-store is mid-initialization inside an import cycle. See
// output-issue-store.ts for the full rationale.
export const useBroadcastVideoStore = Object.assign(
  <T>(selector: (state: BroadcastVideoState) => T): T =>
    (useBroadcastStore as unknown as BroadcastVideoHook)(selector),
  {
    getState: (): BroadcastVideoState => useBroadcastStore.getState(),
  }
) as unknown as BroadcastVideoHook

export function getBroadcastVideoStore(): BroadcastVideoState {
  return useBroadcastVideoStore.getState()
}

export { decideVideoEndAction }
export type { VideoEndDecision }
