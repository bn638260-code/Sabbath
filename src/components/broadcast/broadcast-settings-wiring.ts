import type { BroadcastOutputId } from "@/types"

export interface MonitorInfo {
  name: string
  width: number
  height: number
  x: number
  y: number
  key: string
}

export interface OpenBroadcastWindowArgs {
  outputId: BroadcastOutputId
  monitorIndex: number
  monitorKey: string
  fullscreen: boolean
}

export function buildMonitorKey(monitor: Pick<MonitorInfo, "name" | "width" | "height" | "x" | "y">): string {
  const name = monitor.name.trim().toLowerCase()
  return `${name}|${monitor.width}x${monitor.height}|${monitor.x},${monitor.y}`
}

export function normalizeMonitorList(monitors: MonitorInfo[]): MonitorInfo[] {
  const keyCounts = new Map<string, number>()
  return monitors.map((monitor) => {
    const baseKey = monitor.key || buildMonitorKey(monitor)
    const count = keyCounts.get(baseKey) ?? 0
    keyCounts.set(baseKey, count + 1)
    if (count === 0) {
      return { ...monitor, key: baseKey }
    }
    const suffix = `#${count + 1}`
    return {
      ...monitor,
      key: `${baseKey}${suffix}`,
      name: `${monitor.name} (${count + 1})`,
    }
  })
}

export function resolveMonitorIndexFromKey(
  monitors: MonitorInfo[],
  selectedKey: string,
  fallbackIndex: number,
): number {
  if (monitors.length === 0) return 0

  const byKey = monitors.findIndex((monitor) => monitor.key === selectedKey)
  if (byKey >= 0) return byKey

  const fallback = clampMonitorIndex(fallbackIndex, monitors.length)
  const fallbackMonitor = monitors[fallback]
  if (fallbackMonitor) {
    const baseKey = buildMonitorKey(fallbackMonitor)
    const byBaseKey = monitors.findIndex(
      (monitor) => monitor.key === baseKey || monitor.key.startsWith(`${baseKey}#`),
    )
    if (byBaseKey >= 0) return byBaseKey
  }

  return fallback
}

export function shouldPersistResolvedMonitorKey(
  monitors: MonitorInfo[],
  persistedKey: string,
): boolean {
  if (persistedKey.trim() === "") return true
  return monitors.some((monitor) => monitor.key === persistedKey)
}

export function buildOpenBroadcastWindowArgs(
  outputId: BroadcastOutputId,
  monitors: MonitorInfo[],
  selectedMonitorKey: string,
  fallbackMonitorIndex: number,
  fullscreen: boolean,
): OpenBroadcastWindowArgs {
  return {
    outputId,
    monitorIndex: resolveMonitorIndexFromKey(
      monitors,
      selectedMonitorKey,
      fallbackMonitorIndex,
    ),
    monitorKey: selectedMonitorKey,
    fullscreen,
  }
}

export function clampMonitorIndex(index: number, monitorCount: number): number {
  if (!Number.isFinite(index) || index < 0) return 0
  return Math.min(index, Math.max(0, monitorCount - 1))
}
