import { useEffect, useRef } from "react"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"
import { isTauriRuntime } from "@/lib/tauri-runtime"

declare global {
  interface Window {
    __SABBATHCUE_EVENT_TAP__?: (event: string, payload: unknown) => void
  }
}

function tapTauriEvent(event: string, payload: unknown) {
  if (typeof window === "undefined") return
  window.__SABBATHCUE_EVENT_TAP__?.(event, payload)
}

export function useTauriEvent<T>(
  event: string,
  handler: (payload: T) => void
) {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    if (!isTauriRuntime()) {
      if (
        typeof window === "undefined" ||
        !new URLSearchParams(window.location.search).has("e2e")
      ) {
        return
      }

      const eventName = `sabbathcue:e2e:${event}`
      const replayHandler = (e: Event) => {
        const payload = (e as CustomEvent<T>).detail
        tapTauriEvent(event, payload)
        handlerRef.current(payload)
      }
      window.addEventListener(eventName, replayHandler)
      return () => window.removeEventListener(eventName, replayHandler)
    }

    // Track whether this effect has been cleaned up.
    // React StrictMode unmounts/remounts effects, and the listen() Promise
    // may resolve after cleanup — the cancelled flag prevents stale listeners.
    let cancelled = false
    let unlisten: UnlistenFn | undefined

    void listen<T>(event, (e) => {
      if (!cancelled) {
        tapTauriEvent(event, e.payload)
        handlerRef.current(e.payload)
      }
    }).then((fn) => {
      if (cancelled) {
        // Effect was already cleaned up before the listener registered — remove it immediately
        fn()
      } else {
        unlisten = fn
      }
    }).catch((error) => {
      if (!cancelled) {
        console.warn(`[tauri-event] Failed to listen for "${event}"`, error)
      }
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [event])
}
