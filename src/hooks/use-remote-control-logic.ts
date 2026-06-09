import type { QueueItem } from "@/types"
import { getReferenceFromItem } from "@/types"

export function isRecordPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parsePayload(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw)
      return isRecordPayload(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return isRecordPayload(raw) ? raw : null
}

export function findCurrentVerseIndex(
  items: QueueItem[],
  liveReference: string | undefined | null,
): number | null {
  if (!liveReference) return null
  const index = items.findIndex(
    (item) => getReferenceFromItem(item) === liveReference,
  )
  return index >= 0 ? index : null
}

export function clampQueueNextIndex(
  currentIndex: number | null,
  itemCount: number,
): number {
  if (itemCount === 0) return 0
  return Math.min(currentIndex === null ? 0 : currentIndex + 1, itemCount - 1)
}

export function clampQueuePrevIndex(
  currentIndex: number | null,
  itemCount: number,
): number {
  if (itemCount === 0) return 0
  return Math.max(currentIndex === null ? 0 : currentIndex - 1, 0)
}

export interface RemoteNavigationState {
  items: QueueItem[]
  activeIndex: number | null
  liveReference: string | null
}

export function resolveRemoteNextIndex(state: RemoteNavigationState): number | null {
  if (state.items.length === 0) return null
  const currentIndex =
    state.activeIndex ?? findCurrentVerseIndex(state.items, state.liveReference)
  return clampQueueNextIndex(currentIndex, state.items.length)
}

export function resolveRemotePrevIndex(state: RemoteNavigationState): number | null {
  if (state.items.length === 0) return null
  const currentIndex =
    state.activeIndex ?? findCurrentVerseIndex(state.items, state.liveReference)
  return clampQueuePrevIndex(currentIndex, state.items.length)
}

export function dispatchRemoteNavigation(
  direction: "next" | "prev",
  state: RemoteNavigationState,
  present: (index: number) => void | Promise<void>,
  setActive: (index: number) => void,
): void {
  const index =
    direction === "next"
      ? resolveRemoteNextIndex(state)
      : resolveRemotePrevIndex(state)
  if (index === null) return
  setActive(index)
  void present(index)
}
