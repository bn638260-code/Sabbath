import { useBroadcastStore, type BroadcastState } from "@/stores/broadcast-store"

export type BroadcastThemeDesignerState = Pick<
  BroadcastState,
  | "themes"
  | "activeThemeId"
  | "altActiveThemeId"
  | "loadThemes"
  | "saveTheme"
  | "deleteTheme"
  | "duplicateTheme"
  | "createNewTheme"
  | "renameTheme"
  | "togglePinTheme"
  | "setActiveTheme"
  | "setAltActiveTheme"
  | "isDesignerOpen"
  | "editingThemeId"
  | "renamingThemeId"
  | "draftTheme"
  | "selectedElement"
  | "setDesignerOpen"
  | "startEditing"
  | "stopEditing"
  | "updateDraft"
  | "updateDraftNested"
  | "saveDraft"
  | "discardDraft"
  | "setSelectedElement"
  | "setRenamingTheme"
>

type BroadcastThemeDesignerHook = {
  <T>(selector: (state: BroadcastThemeDesignerState) => T): T
  getState: () => BroadcastThemeDesignerState
}

// Reference useBroadcastStore lazily (at call time) rather than capturing it at
// module-init, so this view can't freeze to `undefined` if it is ever evaluated
// while broadcast-store is mid-initialization inside an import cycle. See
// output-issue-store.ts for the full rationale.
export const useBroadcastThemeDesignerStore = Object.assign(
  <T>(selector: (state: BroadcastThemeDesignerState) => T): T =>
    (useBroadcastStore as unknown as BroadcastThemeDesignerHook)(selector),
  {
    getState: (): BroadcastThemeDesignerState => useBroadcastStore.getState(),
  }
) as unknown as BroadcastThemeDesignerHook

export function getBroadcastThemeDesignerStore(): BroadcastThemeDesignerState {
  return useBroadcastThemeDesignerStore.getState()
}
