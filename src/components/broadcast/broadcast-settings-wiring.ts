export type BroadcastOutputId = "main" | "alt"

export interface OpenBroadcastWindowArgs {
  outputId: BroadcastOutputId
  monitorIndex: number
  fullscreen: boolean
}

export function buildOpenBroadcastWindowArgs(
  outputId: BroadcastOutputId,
  selectedMonitor: string,
  fullscreen: boolean,
): OpenBroadcastWindowArgs {
  return {
    outputId,
    monitorIndex: Number(selectedMonitor),
    fullscreen,
  }
}

export function clampMonitorIndex(index: number, monitorCount: number): number {
  return Math.min(index, Math.max(0, monitorCount - 1))
}

