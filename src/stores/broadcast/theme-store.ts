import type { BroadcastTheme, PresentationRenderData } from "@/types"
import {
  useBroadcastStore,
  useItemTheme,
  type BroadcastState,
} from "@/stores/broadcast-store"
import {
  findThemeById,
  resolveOutputThemeId,
  resolveThemeIdForItem,
} from "@/stores/broadcast/theme-slice"

export type BroadcastThemeState = Pick<
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
>

type BroadcastThemeHook = {
  <T>(selector: (state: BroadcastThemeState) => T): T
  getState: () => BroadcastThemeState
}

export const useBroadcastThemeStore =
  useBroadcastStore as unknown as BroadcastThemeHook

export function getBroadcastThemeStore(): BroadcastThemeState {
  return useBroadcastThemeStore.getState()
}

export function usePresentationItemTheme(
  item: PresentationRenderData | null
): BroadcastTheme | null {
  return useItemTheme(item)
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

export {
  findThemeById,
  resolveOutputThemeId,
  resolveThemeIdForItem,
}
