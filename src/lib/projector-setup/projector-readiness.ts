import type { MonitorInfo } from "@/components/broadcast/broadcast-settings-wiring"
import { findExternalMonitor, matchRememberedMonitor } from "./monitor-match"
import type { RememberedSetup } from "./types"

/**
 * Plain-language readiness of the projector, driving both the header status chip
 * and the guided Projector Setup panel. Ordered from "all good" to "needs help".
 */
export type ProjectorReadiness =
  | "live"
  | "ready-standby"
  | "setup-changed"
  | "possibly-duplicate-mode"
  | "projector-not-detected"
  | "no-remembered-setup"

export interface ProjectorReadinessInput {
  monitors: MonitorInfo[]
  remembered: RememberedSetup | null
  isLive: boolean
}

/** True when 2+ monitors report identical position and size — the mirror signal. */
function monitorsShareGeometry(monitors: MonitorInfo[]): boolean {
  if (monitors.length < 2) return false
  const [first] = monitors
  return monitors.every(
    (monitor) =>
      monitor.x === first.x &&
      monitor.y === first.y &&
      monitor.width === first.width &&
      monitor.height === first.height,
  )
}

export function deriveProjectorReadiness({
  monitors,
  remembered,
  isLive,
}: ProjectorReadinessInput): ProjectorReadiness {
  if (isLive) return "live"

  // A clear mirror/duplicate signal takes priority so we can steer the volunteer
  // to "Extend" before anything else.
  if (monitorsShareGeometry(monitors)) return "possibly-duplicate-mode"

  if (remembered) {
    if (matchRememberedMonitor(monitors, remembered)) return "ready-standby"
    if (findExternalMonitor(monitors)) return "setup-changed"
    return "projector-not-detected"
  }

  return "no-remembered-setup"
}
