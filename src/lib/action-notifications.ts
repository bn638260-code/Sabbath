import { toast } from "sonner"
import { useSettingsStore } from "@/stores/settings-store"

/**
 * Surface an operator action as a transient toast, but only when the
 * "Action notifications" setting is on. Off by default, so this is a no-op
 * unless the operator opts in.
 */
export function notifyAction(message: string, description?: string): void {
  if (!useSettingsStore.getState().actionNotificationsEnabled) return
  toast(message, description ? { description } : undefined)
}
