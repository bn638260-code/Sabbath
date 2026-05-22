export type DashboardViewMode = "balanced" | "broadcast" | "study"

export interface DashboardLayoutPreset {
  topHeightPercent: number
  transcriptWidth: number
  queueWidth: number
  detectionsWidth: number
}

export interface DashboardLayoutState extends DashboardLayoutPreset {
  viewMode: DashboardViewMode
  servicePlanLibraryWidth: number
  liveServiceContextWidth: number
  liveHymnLyricsWidth: number
  sermonSlidesEditorWidth: number
}

export const DASHBOARD_LAYOUT_STORAGE_KEY = "sabbathcue.dashboardLayout.v2"

const WORKSPACE_PANEL_DEFAULTS = {
  servicePlanLibraryWidth: 320,
  liveServiceContextWidth: 320,
  liveHymnLyricsWidth: 360,
  sermonSlidesEditorWidth: 380,
} as const

export const DASHBOARD_LAYOUT_PRESETS: Record<DashboardViewMode, DashboardLayoutPreset> = {
  balanced: {
    topHeightPercent: 48,
    transcriptWidth: 320,
    queueWidth: 320,
    detectionsWidth: 624,
  },
  broadcast: {
    topHeightPercent: 58,
    transcriptWidth: 280,
    queueWidth: 280,
    detectionsWidth: 520,
  },
  study: {
    topHeightPercent: 40,
    transcriptWidth: 340,
    queueWidth: 300,
    detectionsWidth: 480,
  },
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function layoutStateFromPreset(mode: DashboardViewMode): DashboardLayoutState {
  return {
    viewMode: mode,
    ...DASHBOARD_LAYOUT_PRESETS[mode],
    ...WORKSPACE_PANEL_DEFAULTS,
  }
}

export function normalizeDashboardLayoutState(
  value: Partial<DashboardLayoutState> | null | undefined
): DashboardLayoutState {
  const mode: DashboardViewMode =
    value?.viewMode && value.viewMode in DASHBOARD_LAYOUT_PRESETS
      ? value.viewMode
      : "balanced"
  const preset = DASHBOARD_LAYOUT_PRESETS[mode]

  return {
    viewMode: mode,
    topHeightPercent: clampNumber(
      value?.topHeightPercent ?? preset.topHeightPercent,
      34,
      68
    ),
    transcriptWidth: clampNumber(
      value?.transcriptWidth ?? preset.transcriptWidth,
      240,
      520
    ),
    queueWidth: clampNumber(value?.queueWidth ?? preset.queueWidth, 240, 520),
    detectionsWidth: clampNumber(
      value?.detectionsWidth ?? preset.detectionsWidth,
      360,
      760
    ),
    servicePlanLibraryWidth: clampNumber(
      value?.servicePlanLibraryWidth ?? WORKSPACE_PANEL_DEFAULTS.servicePlanLibraryWidth,
      240,
      480
    ),
    liveServiceContextWidth: clampNumber(
      value?.liveServiceContextWidth ?? WORKSPACE_PANEL_DEFAULTS.liveServiceContextWidth,
      240,
      480
    ),
    liveHymnLyricsWidth: clampNumber(
      value?.liveHymnLyricsWidth ?? WORKSPACE_PANEL_DEFAULTS.liveHymnLyricsWidth,
      280,
      520
    ),
    sermonSlidesEditorWidth: clampNumber(
      value?.sermonSlidesEditorWidth ?? WORKSPACE_PANEL_DEFAULTS.sermonSlidesEditorWidth,
      280,
      520
    ),
  }
}

export function loadDashboardLayoutState(): DashboardLayoutState {
  if (typeof window === "undefined") return layoutStateFromPreset("balanced")

  try {
    const raw = window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY)
    if (!raw) return layoutStateFromPreset("balanced")
    return normalizeDashboardLayoutState(JSON.parse(raw) as Partial<DashboardLayoutState>)
  } catch {
    return layoutStateFromPreset("balanced")
  }
}

export function saveDashboardLayoutState(state: DashboardLayoutState): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(
      DASHBOARD_LAYOUT_STORAGE_KEY,
      JSON.stringify(normalizeDashboardLayoutState(state))
    )
  } catch {
    // Ignore storage failures; layout should remain usable.
  }
}
