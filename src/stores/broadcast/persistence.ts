import { load, type Store } from "@tauri-apps/plugin-store"
import { BUILTIN_THEMES } from "@/lib/builtin-themes"
import { isTauriRuntime } from "@/lib/tauri-runtime"
import type { BroadcastTheme } from "@/types"
import {
  findThemeById,
  useBroadcastStore,
  type BroadcastState,
} from "@/stores/broadcast-store"

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

const reportedLoadFailureIds = new Set<string>()

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

let tauriStore: Store | null = null
let hydrationPromise: Promise<void> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSave: Promise<void> = Promise.resolve()
const SAVE_DEBOUNCE_MS = 500

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
