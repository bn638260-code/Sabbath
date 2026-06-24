import type { BroadcastOutputSettingsModel } from "@/hooks/use-broadcast-output-settings"
import type { MonitorInfo } from "@/components/broadcast/broadcast-settings-wiring"
import { NDI_COMING_SOON_MESSAGE } from "@/lib/broadcast-output-settings"

export function canEnableBroadcastOutput(
  model: Pick<
    BroadcastOutputSettingsModel,
    "enabled" | "outputType" | "ndiActive"
  >,
  monitors: MonitorInfo[],
  ndiSdkInstalled: boolean,
): boolean {
  // Keep the SDK flag in the contract, but NDI stays blocked while it is coming soon.
  void ndiSdkInstalled

  if (model.enabled) return true
  if (model.outputType === "display") {
    return monitors.length > 0
  }
  return false
}

export function broadcastOutputBlockedReason(
  model: Pick<
    BroadcastOutputSettingsModel,
    "enabled" | "outputType" | "ndiActive"
  >,
  monitors: MonitorInfo[],
  _ndiSdkInstalled: boolean,
): string | null {
  if (canEnableBroadcastOutput(model, monitors, _ndiSdkInstalled)) return null
  if (model.outputType === "display") {
    return "Connect a display, then refresh monitors."
  }
  return NDI_COMING_SOON_MESSAGE
}
