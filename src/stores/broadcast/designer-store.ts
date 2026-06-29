import { useBroadcastStore, type BroadcastState } from "@/stores/broadcast-store"

export type BroadcastDesignerState = Pick<
  BroadcastState,
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

type BroadcastDesignerHook = {
  <T>(selector: (state: BroadcastDesignerState) => T): T
  getState: () => BroadcastDesignerState
}

export const useBroadcastDesignerStore =
  useBroadcastStore as unknown as BroadcastDesignerHook

export function getBroadcastDesignerStore(): BroadcastDesignerState {
  return useBroadcastDesignerStore.getState()
}
