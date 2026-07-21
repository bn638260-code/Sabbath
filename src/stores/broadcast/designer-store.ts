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

// Reference useBroadcastStore lazily (at call time) rather than capturing it at
// module-init, so this view can't freeze to `undefined` if it is ever evaluated
// while broadcast-store is mid-initialization inside an import cycle. See
// output-issue-store.ts for the full rationale.
export const useBroadcastDesignerStore = Object.assign(
  <T>(selector: (state: BroadcastDesignerState) => T): T =>
    (useBroadcastStore as unknown as BroadcastDesignerHook)(selector),
  {
    getState: (): BroadcastDesignerState => useBroadcastStore.getState(),
  }
) as unknown as BroadcastDesignerHook

export function getBroadcastDesignerStore(): BroadcastDesignerState {
  return useBroadcastDesignerStore.getState()
}
