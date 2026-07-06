import { useEffect } from "react"
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow"
import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"
import {
  normalizeMonitorList,
  type MonitorInfo,
} from "@/components/broadcast/broadcast-settings-wiring"
import { useProjectorSetupStore } from "@/stores/projector-setup-store"

/**
 * Refresh the display list into the shared projector-setup store.
 *
 * Note: this intentionally does NOT touch the persisted `mainDisplayMonitorKey`.
 * When the projector is unplugged, we must keep last week's remembered key so
 * the guided panel can offer to restore it — overwriting it with the laptop
 * screen would defeat the whole feature.
 */
export async function refreshMonitors(): Promise<void> {
  const store = useProjectorSetupStore.getState()
  store.setRefreshing(true)
  try {
    const result = normalizeMonitorList(
      await invokeTauri<MonitorInfo[]>("list_monitors"),
    )
    store.setMonitors(result)
  } catch {
    // list_monitors is unavailable outside the Tauri runtime (web/dev preview);
    // leave the existing list in place.
  } finally {
    store.setRefreshing(false)
  }
}

/**
 * Keep the monitor list fresh without a manual "Refresh" click: fetch on mount,
 * whenever the app regains focus (e.g. right after plugging in the HDMI cable),
 * and on a short interval while the Projector Setup panel is open. Mount once,
 * near the app root.
 */
export function useMonitorWatcher(): void {
  const open = useProjectorSetupStore((s) => s.open)

  useEffect(() => {
    if (!isTauriRuntime()) return

    void refreshMonitors()

    const unlistenFocusChanged = getCurrentWebviewWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) void refreshMonitors()
      })
      .catch(() => {
        // focus events are best-effort
        return undefined
      })

    return () => {
      void unlistenFocusChanged.then((unlisten) => unlisten?.())
    }
  }, [])

  useEffect(() => {
    if (!open || !isTauriRuntime()) return
    const id = setInterval(() => {
      void refreshMonitors()
    }, 2000)
    return () => clearInterval(id)
  }, [open])
}
