export type DashboardViewMode = "balanced" | "broadcast" | "study"

export interface DashboardLayoutPreset {
  topHeightPercent: number
  transcriptWidth: number
  queueWidth: number
  detectionsWidth: number
}

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

