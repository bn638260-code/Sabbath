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

export const useBroadcastVideoStore =
  useBroadcastStore as unknown as BroadcastVideoHook

export function getBroadcastVideoStore(): BroadcastVideoState {
  return useBroadcastVideoStore.getState()
}

export { decideVideoEndAction }
export type { VideoEndDecision }
