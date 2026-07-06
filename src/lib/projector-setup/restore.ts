import type { MonitorInfo } from "@/components/broadcast/broadcast-settings-wiring"
import { findExternalMonitor, matchRememberedMonitor } from "./monitor-match"
import type { RememberedSetup } from "./types"

/**
 * Decide which monitor key the "Go live on the projector" / "Use this screen
 * instead" action should target.
 *
 *   1. the remembered projector, if it is connected
 *   2. otherwise any external screen (handles a swapped projector, or a
 *      first-time setup where nothing is remembered yet)
 *   3. otherwise `null` — there is no external screen to send the output to
 */
export function resolveRestoreTargetKey(
  monitors: MonitorInfo[],
  remembered: RememberedSetup | null,
): string | null {
  const matched = matchRememberedMonitor(monitors, remembered)
  if (matched) return matched.key

  const external = findExternalMonitor(monitors)
  if (external) return external.key

  return null
}
