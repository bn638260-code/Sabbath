import type { RememberedSetup } from "./types"

/**
 * Reconstruct a {@link RememberedSetup} from the persisted monitor key.
 *
 * The broadcast store already persists the last-selected monitor key
 * (`name|WxH|x,y`) and fullscreen preference, so the "last known-good setup" is
 * derived from those rather than stored separately. The name/resolution are
 * parsed back out to enable position-independent re-matching next week.
 */
export function parseRememberedSetupKey(
  monitorKey: string,
  fullscreen: boolean,
): RememberedSetup | null {
  if (!monitorKey) return null

  const parts = monitorKey.split("|")
  if (parts.length < 3) return null

  const dims = parts[parts.length - 2]
  const name = parts.slice(0, parts.length - 2).join("|")
  const dimsMatch = /^(\d+)x(\d+)$/.exec(dims)
  if (!name || !dimsMatch) return null

  return {
    monitorKey,
    monitorName: name,
    width: Number(dimsMatch[1]),
    height: Number(dimsMatch[2]),
    fullscreen,
  }
}
