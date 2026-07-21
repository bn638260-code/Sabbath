import type { BroadcastTheme } from "@/types"
import {
  useBroadcastStore,
  type BroadcastState,
} from "@/stores/broadcast-store"
import {
  findThemeById,
  resolveOutputThemeId,
} from "@/stores/broadcast/theme-slice"

export type BroadcastThemeState = Pick<
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
>

type BroadcastThemeHook = {
  <T>(selector: (state: BroadcastThemeState) => T): T
  getState: () => BroadcastThemeState
}

// Reference useBroadcastStore lazily (at call time) rather than capturing it at
// module-init, so this view can't freeze to `undefined` if it is ever evaluated
// while broadcast-store is mid-initialization inside an import cycle. See
// output-issue-store.ts for the full rationale.
export const useBroadcastThemeStore = Object.assign(
  <T>(selector: (state: BroadcastThemeState) => T): T =>
    (useBroadcastStore as unknown as BroadcastThemeHook)(selector),
  {
    getState: (): BroadcastThemeState => useBroadcastStore.getState(),
  }
) as unknown as BroadcastThemeHook

export function getBroadcastThemeStore(): BroadcastThemeState {
  return useBroadcastThemeStore.getState()
}

export function selectActiveTheme(
  state: BroadcastThemeState
): BroadcastTheme | null {
  return findThemeById(state.themes, state.activeThemeId)
}

export function selectAltActiveTheme(
  state: BroadcastThemeState
): BroadcastTheme | null {
  return findThemeById(state.themes, state.altActiveThemeId)
}

export { findThemeById, resolveOutputThemeId }
