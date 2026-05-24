export type BroadcastOutputId = "main" | "alt"

export interface OpenBroadcastWindowArgs {
  outputId: BroadcastOutputId
  monitorIndex: number
  fullscreen: boolean
}

export function buildOpenBroadcastWindowArgs(
  outputId: BroadcastOutputId,
  selectedMonitor: string,
  fullscreen: boolean
): OpenBroadcastWindowArgs {
  const parsedMonitorIndex = Number.parseInt(selectedMonitor, 10)
  return {
    outputId,
    monitorIndex:
      Number.isFinite(parsedMonitorIndex) && parsedMonitorIndex >= 0
        ? parsedMonitorIndex
        : 0,
    fullscreen,
  }
}

export function clampMonitorIndex(index: number, monitorCount: number): number {
  if (!Number.isFinite(index) || index < 0) return 0
  return Math.min(index, Math.max(0, monitorCount - 1))
}
