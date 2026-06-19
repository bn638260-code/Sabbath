let hymnVoiceControlPromise: Promise<
  typeof import("@/services/hymnal/hymn-voice-control")
> | null = null

export function loadHymnVoiceControl() {
  hymnVoiceControlPromise ??= import("@/services/hymnal/hymn-voice-control")
  return hymnVoiceControlPromise
}
