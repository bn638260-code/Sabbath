import { useBroadcastStore, type BroadcastState } from "@/stores/broadcast-store"

export type BroadcastOutputSettingsState = Pick<
  BroadcastState,
  | "themes"
  | "activeThemeId"
  | "altActiveThemeId"
  | "mainDisplayMonitorIndex"
  | "altDisplayMonitorIndex"
  | "mainDisplayMonitorKey"
  | "altDisplayMonitorKey"
  | "mainProjectorFullscreen"
  | "altProjectorFullscreen"
  | "setActiveTheme"
  | "setAltActiveTheme"
  | "setMainDisplayMonitorIndex"
  | "setAltDisplayMonitorIndex"
  | "setMainDisplayMonitorKey"
  | "setAltDisplayMonitorKey"
  | "setMainProjectorFullscreen"
  | "setAltProjectorFullscreen"
  | "syncBroadcastOutputFor"
  | "reportOutputIssue"
  | "clearOutputIssueFor"
>

type BroadcastOutputSettingsHook = {
  <T>(selector: (state: BroadcastOutputSettingsState) => T): T
  getState: () => BroadcastOutputSettingsState
}

// Reference useBroadcastStore lazily (at call time) rather than capturing it at
// module-init, so this view can't freeze to `undefined` if it is ever evaluated
// while broadcast-store is mid-initialization inside an import cycle. See
// output-issue-store.ts for the full rationale.
export const useBroadcastOutputSettingsStore = Object.assign(
  <T>(selector: (state: BroadcastOutputSettingsState) => T): T =>
    (useBroadcastStore as unknown as BroadcastOutputSettingsHook)(selector),
  {
    getState: (): BroadcastOutputSettingsState => useBroadcastStore.getState(),
  }
) as unknown as BroadcastOutputSettingsHook
