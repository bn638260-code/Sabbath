import { create } from "zustand"
import { load, type Store } from "@tauri-apps/plugin-store"
import { isTauriRuntime, invokeTauri } from "@/lib/tauri-runtime"
import { useBroadcastStore } from "@/stores/broadcast-store"

export type SttProvider = "deepgram" | "gladia" | "soniox" | "vosk"
export type SttLanguage = "en" | "af"

const DEFAULT_CONFIDENCE_THRESHOLD = 0.85
const DEFAULT_SEMANTIC_CONFIDENCE_THRESHOLD = 0.65
const LEGACY_DEFAULT_CONFIDENCE_THRESHOLD = 0.8

interface SettingsState {
  hasDeepgramApiKey: boolean
  hasGladiaApiKey: boolean
  audioDeviceId: string | null
  gain: number
  autoMode: boolean
  autoPreviewDetections: boolean
  confidenceThreshold: number
  semanticConfidenceThreshold: number
  cooldownMs: number
  onboardingComplete: boolean
  sttProvider: SttProvider
  sttLanguage: SttLanguage
  hasSonioxApiKey: boolean
  /** Reduce CPU/RAM use on weaker machines (semantic detection runs on
   *  finished sentences only). */
  lowPowerMode: boolean

  setHasDeepgramApiKey: (has: boolean) => void
  setHasGladiaApiKey: (has: boolean) => void
  setAudioDeviceId: (id: string | null) => void
  setGain: (gain: number) => void
  setAutoMode: (auto: boolean) => void
  setAutoPreviewDetections: (enabled: boolean) => void
  setConfidenceThreshold: (threshold: number) => void
  setSemanticConfidenceThreshold: (threshold: number) => void
  setCooldownMs: (ms: number) => void
  setOnboardingComplete: (complete: boolean) => void
  setSttProvider: (provider: SttProvider) => void
  setSttLanguage: (language: SttLanguage) => void
  setHasSonioxApiKey: (has: boolean) => void
  setLowPowerMode: (enabled: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  hasDeepgramApiKey: false,
  hasGladiaApiKey: false,
  hasSonioxApiKey: false,
  audioDeviceId: null,
  gain: 1.0,
  autoMode: false,
  autoPreviewDetections: true,
  confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
  semanticConfidenceThreshold: DEFAULT_SEMANTIC_CONFIDENCE_THRESHOLD,
  cooldownMs: 2500,
  onboardingComplete: false,
  sttProvider: "vosk",
  sttLanguage: "en",
  lowPowerMode: false,

  setHasDeepgramApiKey: (hasDeepgramApiKey) => set({ hasDeepgramApiKey }),
  setHasGladiaApiKey: (hasGladiaApiKey) => set({ hasGladiaApiKey }),
  setHasSonioxApiKey: (hasSonioxApiKey) => set({ hasSonioxApiKey }),
  setAudioDeviceId: (audioDeviceId) => set({ audioDeviceId }),
  setGain: (gain) => set({ gain }),
  setAutoMode: (autoMode) => set({ autoMode }),
  setAutoPreviewDetections: (autoPreviewDetections) =>
    set({ autoPreviewDetections }),
  setConfidenceThreshold: (confidenceThreshold) => set({ confidenceThreshold }),
  setSemanticConfidenceThreshold: (semanticConfidenceThreshold) =>
    set({ semanticConfidenceThreshold }),
  setCooldownMs: (cooldownMs) => set({ cooldownMs }),
  setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
  setSttProvider: (sttProvider) => set({ sttProvider }),
  setSttLanguage: (sttLanguage) => set({ sttLanguage }),
  setLowPowerMode: (lowPowerMode) => set({ lowPowerMode }),
}))

const PERSISTED_KEYS = [
  "audioDeviceId",
  "gain",
  "autoMode",
  "autoPreviewDetections",
  "confidenceThreshold",
  "semanticConfidenceThreshold",
  "cooldownMs",
  "onboardingComplete",
  "sttProvider",
  "sttLanguage",
  "lowPowerMode",
] as const satisfies readonly (keyof SettingsState)[]

function parseSttProvider(value: unknown): SttProvider {
  if (
    value === "deepgram" ||
    value === "gladia" ||
    value === "soniox" ||
    value === "vosk"
  ) {
    return value
  }
  // Migrate removed/legacy local providers (whisper, faster-whisper,
  // legacy-whisper, sherpa) to the supported local model.
  return "vosk"
}

function parseSttLanguage(value: unknown): SttLanguage {
  if (value === "af") return "af"
  return "en"
}

function parseConfidenceThreshold(value: unknown): unknown {
  if (
    typeof value === "number" &&
    Math.abs(value - LEGACY_DEFAULT_CONFIDENCE_THRESHOLD) < Number.EPSILON
  ) {
    return DEFAULT_CONFIDENCE_THRESHOLD
  }
  return value
}

let tauriStore: Store | null = null
let hydrationPromise: Promise<void> | null = null
let settingsUnsubscribe: (() => void) | null = null
async function getStore(): Promise<Store> {
  if (!tauriStore) {
    tauriStore = await load("settings.json", { autoSave: false, defaults: {} })
  }
  return tauriStore
}

function ensureSettingsPersistenceSubscription() {
  if (settingsUnsubscribe) return

  settingsUnsubscribe = useSettingsStore.subscribe((state, prevState) => {
    const changed = PERSISTED_KEYS.some((k) => state[k] !== prevState[k])
    if (!changed) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      pendingSave = pendingSave.then(() =>
        persistAll(useSettingsStore.getState())
      )
    }, SAVE_DEBOUNCE_MS)
  })
}

/** Load all persisted settings into the Zustand store. Idempotent and
 *  safe against concurrent callers — the first call owns the work and
 *  subsequent callers await the same promise. */
export function hydrateSettings(): Promise<void> {
  if (!isTauriRuntime()) return Promise.resolve()

  if (hydrationPromise) return hydrationPromise
  hydrationPromise = (async () => {
    try {
      const store = await getStore()
      const patch: Partial<SettingsState> = {}
      for (const key of PERSISTED_KEYS) {
        const value = await store.get(key)
        if (value !== undefined && value !== null) {
          if (key === "sttProvider") {
            patch.sttProvider = parseSttProvider(value)
          } else if (key === "sttLanguage") {
            patch.sttLanguage = parseSttLanguage(value)
          } else if (key === "confidenceThreshold") {
            ;(patch as Record<string, unknown>)[key] =
              parseConfidenceThreshold(value)
          } else {
            ;(patch as Record<string, unknown>)[key] = value
          }
        }
      }

      // Resolve keyring-backed secret presence (Deepgram + Gladia) and write only a boolean flag.
      // Best-effort and independent: if a command isn't available (web/dev), keep the default.
      const [deepgram, gladia, soniox] = await Promise.all([
        invokeTauri<boolean>("has_deepgram_api_key").catch(() => undefined),
        invokeTauri<boolean>("has_gladia_api_key").catch(() => undefined),
        invokeTauri<boolean>("has_soniox_api_key").catch(() => undefined),
      ])
      if (deepgram !== undefined) patch.hasDeepgramApiKey = deepgram
      if (gladia !== undefined) patch.hasGladiaApiKey = gladia
      if (soniox !== undefined) patch.hasSonioxApiKey = soniox

      if (Object.keys(patch).length > 0) {
        useSettingsStore.setState(patch)
      }
      // Attach only after successful hydration so as not to overwrite disk with defaults.
      // Debounce writes, so a dragged slider (e.g. gain) coalesces into a single disk write.
      ensureSettingsPersistenceSubscription()
    } catch {
      console.warn("[settings] Failed to load persisted state, using defaults")
      useBroadcastStore.getState().reportOutputIssue({
        outputId: "global",
        kind: "persistence",
        title: "Settings load failed",
        description: "Could not load saved settings; using defaults.",
        id: "global:persistence:settings-load",
      })
    }
  })()
  return hydrationPromise
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave: Promise<void> = Promise.resolve()
const SAVE_DEBOUNCE_MS = 250

async function persistAll(state: SettingsState): Promise<void> {
  try {
    const store = await getStore()
    for (const key of PERSISTED_KEYS) {
      await store.set(key, state[key] as unknown)
    }
    await store.save()
  } catch {
    console.warn("[settings] Failed to persist settings")
    useBroadcastStore.getState().reportOutputIssue({
      outputId: "global",
      kind: "persistence",
      title: "Settings save failed",
      description: "Could not save settings to disk.",
    })
  }
}
