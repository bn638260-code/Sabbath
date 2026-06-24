import { create } from "zustand"
import { emitTo } from "@tauri-apps/api/event"
import { load, type Store } from "@tauri-apps/plugin-store"
import type {
  BroadcastTheme,
  BroadcastTransition,
  BroadcastTransitionType,
  PresentationRenderData,
} from "@/types"
import {
  createOutputIssueSlice,
  selectLatestOutputIssue,
  type OutputIssueSlice,
} from "@/stores/broadcast/output-issue-slice"
import {
  createDesignerSlice,
  type DesignerSlice,
} from "@/stores/broadcast/designer-slice"
import {
  createMonitorSlice,
  type MonitorSlice,
} from "@/stores/broadcast/monitor-slice"
import { BUILTIN_THEMES } from "@/lib/builtin-themes"
import {
  buildVideoCommand,
  emitVideoCommand,
  type VideoTimeUpdatePayload,
  type VideoTransportCommand,
} from "@/lib/broadcast-video-control"
import { isTauriRuntime } from "@/lib/tauri-runtime"
import { restorePresentationDeckForQueueItem } from "@/lib/queued-presentation-deck"
import {
  recordWorkflowTrace,
  tracePresentationDetails,
} from "@/lib/workflow-trace"
import { getPresentationRenderData } from "@/types"
import { useQueueStore } from "@/stores/queue-store"

type BroadcastSyncOptions = { transitionType?: BroadcastTransitionType }
type BroadcastUpdatePayload = {
  theme: BroadcastTheme
  item: PresentationRenderData | null
  opacity: number
  transition?: BroadcastTransition
}

interface BroadcastState extends OutputIssueSlice, DesignerSlice, MonitorSlice {
  themes: BroadcastTheme[]
  activeThemeId: string
  altActiveThemeId: string
  isLive: boolean
  previewItem: PresentationRenderData | null
  liveItem: PresentationRenderData | null
  readingModeAutoLive: boolean
  liveTransitionType: BroadcastTransitionType
  opacity: number
  videoTransport: VideoTimeUpdatePayload | null
  videoLoop: boolean
  videoMuted: boolean
  videoVolume: number
  autoAdvanceVideoOnEnd: boolean
  preferredAudioOutputDeviceId: string

  // Theme management
  loadThemes: () => void
  saveTheme: (theme: BroadcastTheme) => void
  deleteTheme: (id: string) => void
  duplicateTheme: (id: string) => void
  createNewTheme: () => void
  renameTheme: (id: string, name: string) => void
  togglePinTheme: (id: string) => void
  setActiveTheme: (id: string) => void
  setAltActiveTheme: (id: string) => void
  setLive: (live: boolean) => void
  setPreviewItem: (item: PresentationRenderData | null) => void
  setLiveItem: (item: PresentationRenderData | null) => void
  commitLiveItem: (
    item: PresentationRenderData,
    options?: { makeLive?: boolean; transitionType?: BroadcastTransitionType }
  ) => void
  setReadingModeAutoLive: (enabled: boolean) => void
  setLiveTransitionType: (type: BroadcastTransitionType) => void
  setOpacity: (opacity: number) => void
  sendVideoCommand: (command: VideoTransportCommand) => void
  setVideoTransport: (payload: VideoTimeUpdatePayload) => void
  setVideoLoop: (loop: boolean) => void
  setVideoMuted: (muted: boolean) => void
  setVideoVolume: (volume: number) => void
  setPreferredAudioOutputDeviceId: (deviceId: string) => void
  setAutoAdvanceVideoOnEnd: (enabled: boolean) => void
  handleVideoEnded: () => VideoEndDecision
  syncBroadcastOutput: (options?: BroadcastSyncOptions) => void
  syncBroadcastOutputFor: (
    outputId: string,
    options?: BroadcastSyncOptions
  ) => void
}

interface BroadcastHydrationPatchInput {
  customThemes?: BroadcastTheme[] | unknown
  activeId?: string
  altActiveId?: string
  readingModeAutoLive?: boolean
  mainDisplayMonitorIndex?: number
  altDisplayMonitorIndex?: number
  mainDisplayMonitorKey?: string
  altDisplayMonitorKey?: string
  mainProjectorFullscreen?: boolean
  altProjectorFullscreen?: boolean
}

export { selectLatestOutputIssue }

function findThemeById(
  themes: BroadcastTheme[],
  id: string
): BroadcastTheme | null {
  return themes.find((theme) => theme.id === id) ?? themes[0] ?? null
}

/// Fallback so an animated transition is never silently instant when a theme
/// (e.g. an older persisted/custom one) carries a 0ms or missing duration.
const DEFAULT_TRANSITION_DURATION_MS = 500

function transitionForTheme(
  theme: BroadcastTheme,
  type: BroadcastTransitionType
): BroadcastTransition {
  if (type === "none") {
    return { ...theme.transition, type, duration: 0 }
  }
  const themeDuration = theme.transition?.duration
  const duration =
    themeDuration && themeDuration > 0
      ? themeDuration
      : DEFAULT_TRANSITION_DURATION_MS
  return { ...theme.transition, type, duration }
}

function buildBroadcastPayload(
  state: BroadcastState,
  theme: BroadcastTheme,
  options?: BroadcastSyncOptions
): BroadcastUpdatePayload {
  const payload: BroadcastUpdatePayload = {
    theme,
    item: state.isLive ? state.liveItem : null,
    opacity: state.opacity,
  }
  if (options?.transitionType) {
    payload.transition = transitionForTheme(theme, options.transitionType)
  }
  return payload
}

export type VideoEndDecision = "loop" | "advance" | "hold"

const PREFERRED_AUDIO_DEVICE_STORAGE_KEY =
  "sabbathcue:video:preferred-audio-output-device"
const reportedLoadFailureIds = new Set<string>()

export function decideVideoEndAction(input: {
  loop: boolean
  autoAdvance: boolean
  hasNextItem: boolean
}): VideoEndDecision {
  if (input.loop) return "loop"
  if (input.autoAdvance && input.hasNextItem) return "advance"
  return "hold"
}

function readPreferredAudioOutputDeviceId(): string {
  try {
    return (
      globalThis.localStorage.getItem(PREFERRED_AUDIO_DEVICE_STORAGE_KEY) ?? ""
    )
  } catch {
    return ""
  }
}

function savePreferredAudioOutputDeviceId(deviceId: string): void {
  try {
    globalThis.localStorage.setItem(
      PREFERRED_AUDIO_DEVICE_STORAGE_KEY,
      deviceId
    )
  } catch {
    // localStorage is optional in test and non-browser runtimes.
  }
}

export function buildBroadcastHydrationPatch({
  customThemes,
  activeId,
  altActiveId,
  readingModeAutoLive,
  mainDisplayMonitorIndex,
  altDisplayMonitorIndex,
  mainDisplayMonitorKey,
  altDisplayMonitorKey,
  mainProjectorFullscreen,
  altProjectorFullscreen,
}: BroadcastHydrationPatchInput): Partial<BroadcastState> {
  const patch: Partial<BroadcastState> = {}
  if (Array.isArray(customThemes)) {
    patch.themes = [...BUILTIN_THEMES, ...customThemes]
  }
  if (activeId) patch.activeThemeId = activeId
  if (altActiveId) patch.altActiveThemeId = altActiveId
  if (typeof readingModeAutoLive === "boolean") {
    patch.readingModeAutoLive = readingModeAutoLive
  }
  if (typeof mainDisplayMonitorIndex === "number") {
    patch.mainDisplayMonitorIndex = mainDisplayMonitorIndex
  }
  if (typeof altDisplayMonitorIndex === "number") {
    patch.altDisplayMonitorIndex = altDisplayMonitorIndex
  }
  if (typeof mainDisplayMonitorKey === "string") {
    patch.mainDisplayMonitorKey = mainDisplayMonitorKey
  }
  if (typeof altDisplayMonitorKey === "string") {
    patch.altDisplayMonitorKey = altDisplayMonitorKey
  }
  if (typeof mainProjectorFullscreen === "boolean") {
    patch.mainProjectorFullscreen = mainProjectorFullscreen
  }
  if (typeof altProjectorFullscreen === "boolean") {
    patch.altProjectorFullscreen = altProjectorFullscreen
  }

  return patch
}

function reportLoadFailureOnce(
  id: string,
  input: Parameters<BroadcastState["reportOutputIssue"]>[0]
): void {
  if (reportedLoadFailureIds.has(id)) return
  const storageKey = `sabbathcue:${id}:reported`
  try {
    if (globalThis.localStorage.getItem(storageKey) === "1") return
    globalThis.localStorage.setItem(storageKey, "1")
  } catch {
    // localStorage is optional in tests and non-browser runtimes.
  }
  reportedLoadFailureIds.add(id)
  useBroadcastStore.getState().reportOutputIssue({ ...input, id })
}

function clearLoadFailureReport(id: string): void {
  reportedLoadFailureIds.delete(id)
  try {
    globalThis.localStorage.removeItem(`sabbathcue:${id}:reported`)
  } catch {
    // localStorage is optional in tests and non-browser runtimes.
  }
}

export const useBroadcastStore = create<BroadcastState>()((set, get, store) => ({
  ...createOutputIssueSlice(set, get, store),
  ...createDesignerSlice(set, get, store),
  ...createMonitorSlice(set, get, store),
  themes: [...BUILTIN_THEMES],
  activeThemeId: BUILTIN_THEMES[0].id,
  altActiveThemeId: BUILTIN_THEMES[0].id,
  isLive: false,
  previewItem: null,
  liveItem: null,
  readingModeAutoLive: true,
  liveTransitionType: "fade",
  opacity: 1,
  videoTransport: null,
  videoLoop: false,
  videoMuted: false,
  videoVolume: 1,
  autoAdvanceVideoOnEnd: true,
  preferredAudioOutputDeviceId: readPreferredAudioOutputDeviceId(),

  loadThemes: () => {
    set({ themes: [...BUILTIN_THEMES] })
  },
  saveTheme: (theme) =>
    set((s) => ({
      themes: s.themes.some((t) => t.id === theme.id)
        ? s.themes.map((t) => (t.id === theme.id ? theme : t))
        : [...s.themes, theme],
    })),
  deleteTheme: (id) => {
    const { activeThemeId, altActiveThemeId } = get()
    set((s) => {
      const themes = s.themes.filter((t) => t.id !== id || t.builtin)
      const fallbackId = themes[0]?.id ?? BUILTIN_THEMES[0].id
      return {
        themes,
        activeThemeId: s.activeThemeId === id ? fallbackId : s.activeThemeId,
        altActiveThemeId:
          s.altActiveThemeId === id ? fallbackId : s.altActiveThemeId,
      }
    })
    if (activeThemeId === id || altActiveThemeId === id) {
      get().syncBroadcastOutput()
    }
  },
  duplicateTheme: (id) => {
    const s = get()
    const source = s.themes.find((t) => t.id === id)
    if (!source) return
    const newTheme: BroadcastTheme = {
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} Copy`,
      builtin: false,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set((s) => ({ themes: [...s.themes, newTheme] }))
  },
  createNewTheme: () => {
    const source = BUILTIN_THEMES[0]
    const newTheme: BroadcastTheme = {
      ...source,
      id: crypto.randomUUID(),
      name: "Untitled Theme",
      builtin: false,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      background: {
        type: "solid",
        color: "#000000",
        gradient: null,
        image: null,
      },
    }
    set((s) => ({ themes: [...s.themes, newTheme] }))
    get().startEditing(newTheme.id)
  },
  renameTheme: (id, name) =>
    set((s) => ({
      themes: s.themes.map((t) =>
        t.id === id && !t.builtin ? { ...t, name, updatedAt: Date.now() } : t
      ),
      draftTheme:
        s.draftTheme?.id === id
          ? { ...s.draftTheme, name, updatedAt: Date.now() }
          : s.draftTheme,
    })),
  togglePinTheme: (id) =>
    set((s) => ({
      themes: s.themes.map((t) =>
        t.id === id ? { ...t, pinned: !t.pinned, updatedAt: Date.now() } : t
      ),
    })),
  syncBroadcastOutputFor: (outputId: string, options) => {
    const s = get()
    const themeId = outputId === "alt" ? s.altActiveThemeId : s.activeThemeId
    const label = outputId === "alt" ? "broadcast-alt" : "broadcast"
    const theme = findThemeById(s.themes, themeId)
    if (!theme) return

    void emitTo(
      label,
      "broadcast:verse-update",
      buildBroadcastPayload(s, theme, options)
    ).then(
      () => {
        get().clearOutputIssueFor(
          outputId === "alt" ? "alt" : "main",
          "broadcast-sync"
        )
      },
      (error) => {
        console.warn(`[broadcast-store] sync emit to '${label}' failed`, error)
        get().reportOutputIssue({
          outputId: outputId === "alt" ? "alt" : "main",
          kind: "broadcast-sync",
          title: "Broadcast sync failed",
          description: `Could not sync live output to ${label}: ${String(error)}`,
        })
      }
    )
  },
  syncBroadcastOutput: (options) => {
    get().syncBroadcastOutputFor("main", options)
    get().syncBroadcastOutputFor("alt", options)
  },
  setActiveTheme: (activeThemeId) => {
    set({ activeThemeId })
    get().syncBroadcastOutputFor("main")
  },
  setAltActiveTheme: (altActiveThemeId) => {
    set({ altActiveThemeId })
    get().syncBroadcastOutputFor("alt")
  },
  setLive: (isLive) => {
    const shouldStopVideo = !isLive && get().liveItem?.kind === "video"
    set({ isLive })
    recordWorkflowTrace(
      "live.state",
      isLive ? "Live screen shown" : "Live screen hidden",
      {
        isLive,
        live: tracePresentationDetails(get().liveItem),
      }
    )
    get().syncBroadcastOutput()
    if (shouldStopVideo) get().sendVideoCommand({ type: "stop" })
  },
  setPreviewItem: (previewItem) => {
    set({ previewItem })
    recordWorkflowTrace("preview.state", "Preview state updated", {
      preview: tracePresentationDetails(previewItem),
    })
  },
  setLiveItem: (liveItem) => {
    set({ liveItem })
    recordWorkflowTrace("live.state", "Live item state updated", {
      isLive: get().isLive,
      live: tracePresentationDetails(liveItem),
    })
    get().syncBroadcastOutput()
  },
  commitLiveItem: (liveItem, options) => {
    const makeLive = options?.makeLive ?? true
    const previousWasVideo = get().liveItem?.kind === "video"
    set(makeLive ? { liveItem, isLive: true } : { liveItem })
    recordWorkflowTrace("live.state", "Live commit state applied", {
      makeLive,
      isLive: get().isLive,
      live: tracePresentationDetails(get().liveItem),
    })
    get().syncBroadcastOutput({
      transitionType: options?.transitionType ?? get().liveTransitionType,
    })
    if (liveItem.kind === "video") {
      get().sendVideoCommand({ type: "load", item: liveItem })
      const sinkId = get().preferredAudioOutputDeviceId
      if (sinkId) get().sendVideoCommand({ type: "setSinkId", sinkId })
    } else if (previousWasVideo) {
      get().sendVideoCommand({ type: "stop" })
    }
  },
  setReadingModeAutoLive: (readingModeAutoLive) => {
    set({ readingModeAutoLive })
  },
  setLiveTransitionType: (liveTransitionType) => {
    set({ liveTransitionType })
  },
  setOpacity: (opacity) => {
    const nextOpacity = Number.isFinite(opacity)
      ? Math.max(0, Math.min(1, opacity))
      : 1
    set({ opacity: nextOpacity })
    get().syncBroadcastOutput()
  },
  sendVideoCommand: (command) => {
    const payload = buildVideoCommand(command)
    if (payload.type === "setLoop") set({ videoLoop: payload.loop })
    if (payload.type === "setMuted") set({ videoMuted: payload.muted })
    if (payload.type === "setVolume") set({ videoVolume: payload.volume })
    if (payload.type === "setSinkId") {
      savePreferredAudioOutputDeviceId(payload.sinkId)
      set({ preferredAudioOutputDeviceId: payload.sinkId })
    }
    void emitVideoCommand(payload).catch((error) => {
      console.warn("[broadcast-store] video command emit failed", error)
      get().reportOutputIssue({
        outputId: "global",
        kind: "broadcast-sync",
        title: "Video control failed",
        description: `Could not send video control: ${String(error)}`,
      })
    })
  },
  setVideoTransport: (payload) => {
    set({
      videoTransport: payload,
      videoLoop: payload.loop,
      videoMuted: payload.muted,
      videoVolume: payload.volume,
    })
  },
  setVideoLoop: (loop) => {
    set({ videoLoop: loop })
    get().sendVideoCommand({ type: "setLoop", loop })
  },
  setVideoMuted: (muted) => {
    set({ videoMuted: muted })
    get().sendVideoCommand({ type: "setMuted", muted })
  },
  setVideoVolume: (volume) => {
    const nextVolume = Math.max(
      0,
      Math.min(1, Number.isFinite(volume) ? volume : 1)
    )
    set({ videoVolume: nextVolume })
    get().sendVideoCommand({ type: "setVolume", volume: nextVolume })
  },
  setPreferredAudioOutputDeviceId: (deviceId) => {
    savePreferredAudioOutputDeviceId(deviceId)
    set({ preferredAudioOutputDeviceId: deviceId })
    get().sendVideoCommand({ type: "setSinkId", sinkId: deviceId })
  },
  setAutoAdvanceVideoOnEnd: (enabled) => {
    set({ autoAdvanceVideoOnEnd: enabled })
  },
  handleVideoEnded: () => {
    const queue = useQueueStore.getState()
    const nextIndex =
      queue.activeIndex === null
        ? -1
        : Math.min(queue.activeIndex + 1, queue.items.length - 1)
    const nextItem = nextIndex >= 0 ? queue.items[nextIndex] : null
    const decision = decideVideoEndAction({
      loop: get().videoLoop,
      autoAdvance: get().autoAdvanceVideoOnEnd,
      hasNextItem: Boolean(nextItem),
    })

    if (decision === "loop") {
      get().sendVideoCommand({ type: "restart" })
      return decision
    }
    if (decision === "advance" && nextItem) {
      queue.setActive(nextIndex)
      restorePresentationDeckForQueueItem(nextItem)
      const renderData = getPresentationRenderData(nextItem.presentation)
      get().commitLiveItem(renderData)
    }
    return decision
  },
}))

// ── Theme persistence via tauri-plugin-store ──

let tauriStore: Store | null = null
let hydrationPromise: Promise<void> | null = null

async function getThemeStore(): Promise<Store> {
  if (!tauriStore) {
    tauriStore = await load("broadcast-themes.json", {
      autoSave: false,
      defaults: {},
    })
  }
  return tauriStore
}

export function hydrateBroadcastThemes(): Promise<void> {
  if (!isTauriRuntime()) return Promise.resolve()

  if (hydrationPromise) return hydrationPromise
  hydrationPromise = (async () => {
    try {
      const store = await getThemeStore()
      const customThemes = (await store.get("customThemes")) as
        | BroadcastTheme[]
        | undefined
      const activeId = (await store.get("activeThemeId")) as string | undefined
      const altActiveId = (await store.get("altActiveThemeId")) as
        | string
        | undefined
      const readingModeAutoLive = (await store.get("readingModeAutoLive")) as
        | boolean
        | undefined
      const mainDisplayMonitorIndex = (await store.get(
        "mainDisplayMonitorIndex"
      )) as number | undefined
      const altDisplayMonitorIndex = (await store.get(
        "altDisplayMonitorIndex"
      )) as number | undefined
      const mainDisplayMonitorKey = (await store.get(
        "mainDisplayMonitorKey"
      )) as string | undefined
      const altDisplayMonitorKey = (await store.get("altDisplayMonitorKey")) as
        | string
        | undefined
      const mainProjectorFullscreen = (await store.get(
        "mainProjectorFullscreen"
      )) as boolean | undefined
      const altProjectorFullscreen = (await store.get(
        "altProjectorFullscreen"
      )) as boolean | undefined

      const patch = buildBroadcastHydrationPatch({
        customThemes,
        activeId,
        altActiveId,
        readingModeAutoLive,
        mainDisplayMonitorIndex,
        altDisplayMonitorIndex,
        mainDisplayMonitorKey,
        altDisplayMonitorKey,
        mainProjectorFullscreen,
        altProjectorFullscreen,
      })

      if (Object.keys(patch).length > 0) {
        useBroadcastStore.setState(patch)
      }
      clearLoadFailureReport("global:persistence:broadcast-theme-load")

      // Auto-persist on changes (debounced)
      useBroadcastStore.subscribe((state, prevState) => {
        const changed =
          state.themes !== prevState.themes ||
          state.activeThemeId !== prevState.activeThemeId ||
          state.altActiveThemeId !== prevState.altActiveThemeId ||
          state.readingModeAutoLive !== prevState.readingModeAutoLive ||
          state.mainDisplayMonitorIndex !== prevState.mainDisplayMonitorIndex ||
          state.altDisplayMonitorIndex !== prevState.altDisplayMonitorIndex ||
          state.mainDisplayMonitorKey !== prevState.mainDisplayMonitorKey ||
          state.altDisplayMonitorKey !== prevState.altDisplayMonitorKey ||
          state.mainProjectorFullscreen !== prevState.mainProjectorFullscreen ||
          state.altProjectorFullscreen !== prevState.altProjectorFullscreen
        if (!changed) return
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
          saveTimer = null
          pendingSave = pendingSave.then(() =>
            persistBroadcastThemes(useBroadcastStore.getState())
          )
        }, SAVE_DEBOUNCE_MS)
      })
    } catch {
      hydrationPromise = null
      console.warn(
        "[broadcast] Failed to load persisted themes, using defaults"
      )
      reportLoadFailureOnce("global:persistence:broadcast-theme-load", {
        outputId: "global",
        kind: "persistence",
        title: "Theme load failed",
        description: "Could not load saved broadcast themes; using defaults.",
      })
    }
  })()
  return hydrationPromise
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave: Promise<void> = Promise.resolve()
const SAVE_DEBOUNCE_MS = 500

export function selectActiveTheme(
  state: BroadcastState
): BroadcastTheme | null {
  return findThemeById(state.themes, state.activeThemeId)
}

export function selectAltActiveTheme(
  state: BroadcastState
): BroadcastTheme | null {
  return findThemeById(state.themes, state.altActiveThemeId)
}

async function persistBroadcastThemes(state: BroadcastState): Promise<void> {
  try {
    const store = await getThemeStore()
    const customThemes = state.themes.filter((t) => !t.builtin)
    await store.set("customThemes", customThemes)
    await store.set("activeThemeId", state.activeThemeId)
    await store.set("altActiveThemeId", state.altActiveThemeId)
    await store.set("readingModeAutoLive", state.readingModeAutoLive)
    await store.set("mainDisplayMonitorIndex", state.mainDisplayMonitorIndex)
    await store.set("altDisplayMonitorIndex", state.altDisplayMonitorIndex)
    await store.set("mainDisplayMonitorKey", state.mainDisplayMonitorKey)
    await store.set("altDisplayMonitorKey", state.altDisplayMonitorKey)
    await store.set("mainProjectorFullscreen", state.mainProjectorFullscreen)
    await store.set("altProjectorFullscreen", state.altProjectorFullscreen)
    await store.save()
  } catch {
    console.warn("[broadcast] Failed to persist themes")
    useBroadcastStore.getState().reportOutputIssue({
      outputId: "global",
      kind: "persistence",
      title: "Theme save failed",
      description: "Could not save broadcast theme settings to disk.",
    })
  }
}
