import { useBroadcastStore, type BroadcastState } from "@/stores/broadcast-store"

export type BroadcastThemeDesignerState = Pick<
  BroadcastState,
  | "themes"
  | "activeThemeId"
  | "altActiveThemeId"
  | "hymnThemeId"
  | "loadThemes"
  | "saveTheme"
  | "deleteTheme"
  | "duplicateTheme"
  | "createNewTheme"
  | "renameTheme"
  | "togglePinTheme"
  | "setActiveTheme"
  | "setAltActiveTheme"
  | "setHymnTheme"
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

export const useBroadcastThemeDesignerStore =
  useBroadcastStore as unknown as BroadcastThemeDesignerHook

export function getBroadcastThemeDesignerStore(): BroadcastThemeDesignerState {
  return useBroadcastThemeDesignerStore.getState()
}
