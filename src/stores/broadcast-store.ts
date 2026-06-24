import { create } from "zustand"
import { emitTo } from "@tauri-apps/api/event"
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
import {
  createVideoSlice,
  decideVideoEndAction,
  type VideoEndDecision,
  type VideoSlice,
} from "@/stores/broadcast/video-slice"
import { BUILTIN_THEMES } from "@/lib/builtin-themes"
import {
  recordWorkflowTrace,
  tracePresentationDetails,
} from "@/lib/workflow-trace"
export {
  buildBroadcastHydrationPatch,
  hydrateBroadcastThemes,
  selectActiveTheme,
  selectAltActiveTheme,
} from "@/stores/broadcast/persistence"

type BroadcastSyncOptions = { transitionType?: BroadcastTransitionType }
type BroadcastUpdatePayload = {
  theme: BroadcastTheme
  item: PresentationRenderData | null
  opacity: number
  transition?: BroadcastTransition
}

interface BroadcastState
  extends OutputIssueSlice,
    DesignerSlice,
    MonitorSlice,
    VideoSlice {
  themes: BroadcastTheme[]
  activeThemeId: string
  altActiveThemeId: string
  isLive: boolean
  previewItem: PresentationRenderData | null
  liveItem: PresentationRenderData | null
  readingModeAutoLive: boolean
  liveTransitionType: BroadcastTransitionType
  opacity: number

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
  syncBroadcastOutput: (options?: BroadcastSyncOptions) => void
  syncBroadcastOutputFor: (
    outputId: string,
    options?: BroadcastSyncOptions
  ) => void
}

export { selectLatestOutputIssue }

export function findThemeById(
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

export { decideVideoEndAction }
export type { VideoEndDecision }

export const useBroadcastStore = create<BroadcastState>()((set, get, store) => ({
  ...createOutputIssueSlice(set, get, store),
  ...createDesignerSlice(set, get, store),
  ...createMonitorSlice(set, get, store),
  ...createVideoSlice(set, get, store),
  themes: [...BUILTIN_THEMES],
  activeThemeId: BUILTIN_THEMES[0].id,
  altActiveThemeId: BUILTIN_THEMES[0].id,
  isLive: false,
  previewItem: null,
  liveItem: null,
  readingModeAutoLive: true,
  liveTransitionType: "fade",
  opacity: 1,

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
}))
