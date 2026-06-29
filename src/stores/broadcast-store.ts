import { create } from "zustand"
import type { BroadcastTheme, PresentationRenderData } from "@/types"
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
import {
  createThemeSlice,
  findThemeById,
  resolveOutputThemeId,
  resolveThemeIdForItem,
  type ThemeSlice,
} from "@/stores/broadcast/theme-slice"
import {
  createLiveSlice,
  type LiveSlice,
} from "@/stores/broadcast/live-slice"

export type { BroadcastSyncOptions } from "@/stores/broadcast/live-slice"
export {
  buildBroadcastHydrationPatch,
  hydrateBroadcastThemes,
  selectActiveTheme,
  selectAltActiveTheme,
} from "@/stores/broadcast/persistence"

export interface BroadcastState
  extends OutputIssueSlice,
    DesignerSlice,
    MonitorSlice,
    VideoSlice,
    ThemeSlice,
    LiveSlice {}

export { selectLatestOutputIssue, findThemeById, resolveThemeIdForItem, resolveOutputThemeId }

/** Theme an in-app surface should use to render a specific item. */
export function useItemTheme(
  item: PresentationRenderData | null
): BroadcastTheme | null {
  return useBroadcastStore((s) =>
    findThemeById(
      s.themes,
      resolveThemeIdForItem(item, s.activeThemeId, s.hymnThemeId)
    )
  )
}

export { decideVideoEndAction }
export type { VideoEndDecision }

export const useBroadcastStore = create<BroadcastState>()((set, get, store) => ({
  ...createOutputIssueSlice(set, get, store),
  ...createDesignerSlice(set, get, store),
  ...createMonitorSlice(set, get, store),
  ...createVideoSlice(set, get, store),
  ...createThemeSlice(set, get, store),
  ...createLiveSlice(set, get, store),
}))
