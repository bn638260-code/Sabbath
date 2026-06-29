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

export const useBroadcastOutputSettingsStore =
  useBroadcastStore as unknown as BroadcastOutputSettingsHook
