import { type StateCreator } from "zustand"
import { emitTo } from "@tauri-apps/api/event"
import type { BroadcastTheme } from "@/types"
import type { BroadcastState } from "@/stores/broadcast-store"

type SelectedElement = "verse" | "reference" | null

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split(".")
  const isIndex = (key: string) => /^\d+$/.test(key)
  const result: Record<string, unknown> = Array.isArray(obj)
    ? ([...obj] as unknown as Record<string, unknown>)
    : { ...obj }

  let current: Record<string, unknown> | unknown[] = result
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    const nextKey = keys[i + 1]
    const currentIndex = isIndex(key) ? Number(key) : key
    const existing = (current as Record<string, unknown> | unknown[])[
      currentIndex as keyof typeof current
    ]
    const nextContainer = Array.isArray(existing)
      ? [...existing]
      : existing && typeof existing === "object"
        ? { ...(existing as Record<string, unknown>) }
        : isIndex(nextKey)
          ? []
          : {}

    ;(current as Record<string, unknown> | unknown[])[
      currentIndex as keyof typeof current
    ] = nextContainer as never
    current = nextContainer as Record<string, unknown> | unknown[]
  }

  const lastKey = keys[keys.length - 1]
  const lastIndex = isIndex(lastKey) ? Number(lastKey) : lastKey
  ;(current as Record<string, unknown> | unknown[])[
    lastIndex as keyof typeof current
  ] = value as never

  return result
}

function reportSyncFailure(
  report: BroadcastState["reportOutputIssue"],
  outputId: "main" | "alt",
  label: string,
  error: unknown
): void {
  console.warn(`[broadcast-store] emit draft to '${label}' failed`, error)
  report({
    outputId,
    kind: "broadcast-sync",
    title: "Broadcast sync failed",
    description: `Could not sync draft to ${label}: ${String(error)}`,
  })
}

function emitDraftToBroadcast(state: BroadcastState): void {
  if (!state.draftTheme) return
  const id = state.editingThemeId
  const report = state.reportOutputIssue
  if (id === state.activeThemeId) {
    void emitTo("broadcast", "broadcast:verse-update", {
      theme: state.draftTheme,
      item: state.isLive ? state.liveItem : null,
      opacity: state.opacity,
    }).catch((error) => reportSyncFailure(report, "main", "broadcast", error))
  }
  if (id === state.altActiveThemeId) {
    void emitTo("broadcast-alt", "broadcast:verse-update", {
      theme: state.draftTheme,
      item: state.isLive ? state.liveItem : null,
      opacity: state.opacity,
    }).catch((error) =>
      reportSyncFailure(report, "alt", "broadcast-alt", error)
    )
  }
}

let draftBroadcastFrame: number | null = null

function scheduleDraftBroadcast(getState: () => BroadcastState): void {
  if (draftBroadcastFrame !== null) return

  const flush = () => {
    draftBroadcastFrame = null
    emitDraftToBroadcast(getState())
  }

  if (
    typeof window === "undefined" ||
    typeof window.requestAnimationFrame !== "function"
  ) {
    flush()
    return
  }

  draftBroadcastFrame = window.requestAnimationFrame(flush)
}

export interface DesignerSlice {
  isDesignerOpen: boolean
  editingThemeId: string | null
  renamingThemeId: string | null
  draftTheme: BroadcastTheme | null
  selectedElement: SelectedElement
  setDesignerOpen: (open: boolean) => void
  startEditing: (themeId: string) => void
  stopEditing: () => void
  updateDraft: (updates: Partial<BroadcastTheme>) => void
  updateDraftNested: (path: string, value: unknown) => void
  saveDraft: () => void
  discardDraft: () => void
  setSelectedElement: (el: SelectedElement) => void
  setRenamingTheme: (id: string | null) => void
}

export const createDesignerSlice: StateCreator<
  BroadcastState,
  [],
  [],
  DesignerSlice
> = (set, get) => ({
  isDesignerOpen: false,
  editingThemeId: null,
  renamingThemeId: null,
  draftTheme: null,
  selectedElement: null,

  setDesignerOpen: (isDesignerOpen) => {
    if (!isDesignerOpen) {
      set({
        isDesignerOpen,
        editingThemeId: null,
        draftTheme: null,
        selectedElement: null,
      })
    } else {
      set({ isDesignerOpen })
    }
  },
  startEditing: (themeId) => {
    const theme = get().themes.find((t) => t.id === themeId)
    if (!theme) return
    set({
      editingThemeId: themeId,
      draftTheme: { ...theme, updatedAt: Date.now() },
      selectedElement: null,
    })
  },
  stopEditing: () => {
    set({
      editingThemeId: null,
      draftTheme: null,
      selectedElement: null,
    })
  },
  updateDraft: (updates) => {
    set((s) => ({
      draftTheme: s.draftTheme
        ? { ...s.draftTheme, ...updates, updatedAt: Date.now() }
        : null,
    }))
    scheduleDraftBroadcast(get)
  },
  updateDraftNested: (path, value) => {
    set((s) => ({
      draftTheme: s.draftTheme
        ? (setNestedValue(
            s.draftTheme as unknown as Record<string, unknown>,
            path,
            value
          ) as unknown as BroadcastTheme)
        : null,
    }))
    scheduleDraftBroadcast(get)
  },
  saveDraft: () => {
    const { draftTheme } = get()
    if (!draftTheme) return
    // If editing a builtin, save as a new custom theme
    if (draftTheme.builtin) {
      const customTheme = {
        ...draftTheme,
        id: crypto.randomUUID(),
        name: `${draftTheme.name} (Custom)`,
        builtin: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      set((s) => ({
        themes: [...s.themes, customTheme],
        editingThemeId: customTheme.id,
        draftTheme: customTheme,
      }))
    } else {
      get().saveTheme(draftTheme)
    }
  },
  discardDraft: () => {
    const { editingThemeId } = get()
    if (editingThemeId) {
      get().startEditing(editingThemeId)
    }
  },
  setSelectedElement: (selectedElement) => set({ selectedElement }),
  setRenamingTheme: (id) => set({ renamingThemeId: id }),
})
