import type { MonitorInfo } from "@/components/broadcast/broadcast-settings-wiring"
import type { RememberedSetup } from "./types"

/**
 * Resolve a remembered setup to a concrete monitor in the current list.
 *
 * Fallback ladder:
 *   1. exact geometry `key`
 *   2. same `name` + resolution (position-independent — the projector may have
 *      reconnected at a different desktop offset, changing its key)
 *   3. none
 */
export function matchRememberedMonitor(
  monitors: MonitorInfo[],
  remembered: RememberedSetup | null,
): MonitorInfo | null {
  if (!remembered) return null

  const byKey = monitors.find((monitor) => monitor.key === remembered.monitorKey)
  if (byKey) return byKey

  const rememberedName = remembered.monitorName.trim().toLowerCase()
  const byNameAndResolution = monitors.find(
    (monitor) =>
      monitor.name.trim().toLowerCase() === rememberedName &&
      monitor.width === remembered.width &&
      monitor.height === remembered.height,
  )

  return byNameAndResolution ?? null
}

/**
 * Best guess at which monitor is the external projector/TV.
 *
 * The Windows primary display sits at origin `(0,0)`, so the first monitor not
 * at the origin is the external one. When every monitor sits at the origin
 * (e.g. mirror/duplicate reporting), treat the last monitor as external.
 */
export function findExternalMonitor(
  monitors: MonitorInfo[],
): MonitorInfo | null {
  if (monitors.length === 0) return null

  const offOrigin = monitors.find((monitor) => monitor.x !== 0 || monitor.y !== 0)
  if (offOrigin) return offOrigin

  if (monitors.length > 1) return monitors[monitors.length - 1]

  return null
}
