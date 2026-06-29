import { useEffect } from "react"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"
import { useBroadcastRemoteControlStore as useBroadcastStore } from "@/stores/broadcast/remote-control-store"
import { useBibleStore } from "@/stores/bible-store"
import { useQueueStore } from "@/stores/queue-store"
import { useSettingsStore } from "@/stores/settings-store"
import { presentVerse } from "@/lib/presentation-workflow"
import { presentQueuedItem } from "@/lib/queue-presentation"
import {
  createRemotePresentationQueue,
  dispatchRemoteNavigation,
  parsePayload,
} from "@/hooks/use-remote-control-logic"
import { getScriptureVerse, type Verse } from "@/types"

/**
 * Listens for remote control events from the Rust backend (OSC / HTTP API)
 * and dispatches them to the appropriate Zustand stores.
 *
 * Mount this hook once at the app root level.
 */
export function useRemoteControl() {
  useEffect(() => {
    if (!isTauriRuntime()) return

    let cancelled = false
    const unlisteners: UnlistenFn[] = []
    const presentQueueItemInOrder =
      createRemotePresentationQueue(presentQueueItem)
    const addUnlistener = (fn: UnlistenFn) => {
      if (cancelled) {
        fn()
      } else {
        unlisteners.push(fn)
      }
    }

    async function setup() {
      // remote:next — advance queue to next verse and present it
      const u1 = await listen("remote:next", () => {
        if (cancelled) return
        const queue = useQueueStore.getState()
        const broadcast = useBroadcastStore.getState()
        dispatchRemoteNavigation(
          "next",
          {
            items: queue.items,
            activeIndex: queue.activeIndex,
            liveReference: broadcast.liveItem?.reference ?? null,
          },
          presentQueueItemInOrder,
          (index) => useQueueStore.getState().setActive(index)
        )
      })
      addUnlistener(u1)

      // remote:prev — go to previous verse in queue and present it
      const u2 = await listen("remote:prev", () => {
        if (cancelled) return
        const queue = useQueueStore.getState()
        const broadcast = useBroadcastStore.getState()
        dispatchRemoteNavigation(
          "prev",
          {
            items: queue.items,
            activeIndex: queue.activeIndex,
            liveReference: broadcast.liveItem?.reference ?? null,
          },
          presentQueueItemInOrder,
          (index) => useQueueStore.getState().setActive(index)
        )
      })
      addUnlistener(u2)

      // remote:theme — switch active theme by name
      const u3 = await listen<string>("remote:theme", (event) => {
        if (cancelled) return
        const payload = parsePayload(event.payload)
        const name = payload?.name as string | undefined
        if (!name) return

        const { themes } = useBroadcastStore.getState()
        const theme = themes.find(
          (t) => t.name.toLowerCase() === name.toLowerCase()
        )
        if (theme) {
          useBroadcastStore.getState().setActiveTheme(theme.id)
        }
      })
      addUnlistener(u3)

      // remote:opacity — set broadcast output opacity
      const u4 = await listen<string>("remote:opacity", (event) => {
        if (cancelled) return
        const payload = parsePayload(event.payload)
        const value = payload?.value as number | undefined
        if (value === undefined) return
        useBroadcastStore.getState().setOpacity(value)
      })
      addUnlistener(u4)

      // remote:on_air — toggle live broadcast state
      const u5 = await listen<string>("remote:on_air", (event) => {
        if (cancelled) return
        const payload = parsePayload(event.payload)
        const active = payload?.active as boolean | undefined
        if (active === undefined) return
        useBroadcastStore.getState().setLive(active)
      })
      addUnlistener(u5)

      // remote:show — show broadcast output
      const u6 = await listen("remote:show", () => {
        if (cancelled) return
        useBroadcastStore.getState().setLive(true)
      })
      addUnlistener(u6)

      // remote:hide — hide broadcast output
      const u7 = await listen("remote:hide", () => {
        if (cancelled) return
        useBroadcastStore.getState().setLive(false)
      })
      addUnlistener(u7)

      // remote:confidence — set detection confidence threshold
      const u8 = await listen<string>("remote:confidence", (event) => {
        if (cancelled) return
        const payload = parsePayload(event.payload)
        const value = payload?.value as number | undefined
        if (value === undefined) return
        useSettingsStore.getState().setConfidenceThreshold(value)
      })
      addUnlistener(u8)
    }

    setup()

    // Sync status snapshot to Rust backend periodically for HTTP GET /api/v1/status
    const statusInterval = setInterval(() => {
      syncStatusSnapshot()
    }, 1000)

    return () => {
      cancelled = true
      unlisteners.forEach((fn) => fn())
      clearInterval(statusInterval)
    }
  }, [])
}

/**
 * Present a queue item at the given index to the live display.
 * Mirrors the logic from QueueItemRow's handlePresent.
 */
async function presentQueueItem(index: number) {
  try {
    const { items } = useQueueStore.getState()
    const item = items[index]
    if (!item) return

    const verse = getScriptureVerse(item.presentation)
    if (!verse) {
      presentQueuedItem(item)
      return
    }

    // Fetch the full verse from the backend to ensure we have complete data
    // (AI-detected queue items may have partial verse objects)
    const fullVerse = await invokeTauri<Verse | null>("get_verse", {
      translationId: useBibleStore.getState().activeTranslationId,
      bookNumber: verse.book_number,
      chapter: verse.chapter,
      verse: verse.verse,
    })

    const verseToPresent = fullVerse ?? verse

    presentVerse(verseToPresent)
  } catch (e) {
    console.warn("[remote-control] presentQueueItem failed:", e)
  }
}

/**
 * Push current frontend state to the Rust-managed StatusSnapshot.
 */
function syncStatusSnapshot() {
  const broadcast = useBroadcastStore.getState()
  const queue = useQueueStore.getState()
  const settings = useSettingsStore.getState()

  const activeTheme = broadcast.themes.find(
    (t) => t.id === broadcast.activeThemeId
  )

  if (!isTauriRuntime()) return

  invokeTauri("update_remote_status", {
    onAir: broadcast.isLive,
    activeTheme: activeTheme?.name ?? null,
    liveVerse: broadcast.liveItem?.reference ?? null,
    queueLength: queue.items.length,
    confidenceThreshold: settings.confidenceThreshold,
  }).catch(() => {
    // Silently ignore — HTTP server may not be running
  })
}
