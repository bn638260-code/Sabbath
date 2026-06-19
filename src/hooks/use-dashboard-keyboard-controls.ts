import { useEffect } from "react"
import {
  commitPreviewToLive,
  presentItem,
  selectPreviewItem,
} from "@/lib/presentation-workflow"
import { presentQueuedItem, previewQueuedItem } from "@/lib/queue-presentation"
import { restoreQueuedHymnDeckForRenderItem } from "@/lib/queued-hymn-deck"
import {
  blackoutOutput,
  clearLiveOutput,
  clearPreviewOutput,
  toggleLiveOutputVisibility,
  toggleTranscription,
} from "@/lib/operator-actions"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useQueueStore } from "@/stores/queue-store"
import { useDashboardWorkspaceStore } from "@/stores/dashboard-workspace-store"
import {
  clampDeckIndex,
  egwDeckSlides,
  findDeckIndex,
  hymnDeckSlides,
  presentationDeckKind,
  presentationDeckSlideId,
  sermonDeckSlides,
} from "@/lib/presentation-deck-navigation"
import { useEgwSlideStore } from "@/stores/egw-slide-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useTutorialStore } from "@/stores/tutorial-store"
import type { PresentationRenderData } from "@/types"

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  if (target.isContentEditable) return true

  const tagName = target.tagName.toLowerCase()
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true
  }

  return Boolean(
    target.closest(
      '[contenteditable="true"], input, textarea, select, [role="textbox"], [role="combobox"], [role="spinbutton"]'
    )
  )
}

function selectQueueItem(delta: number): void {
  const queue = useQueueStore.getState()
  if (queue.items.length === 0) return

  const fallbackIndex = delta > 0 ? -1 : queue.items.length
  const nextIndex = Math.max(
    0,
    Math.min(
      queue.items.length - 1,
      (queue.activeIndex ?? fallbackIndex) + delta
    )
  )
  const item = queue.items[nextIndex]
  if (!item) return

  queue.setActive(nextIndex)
  previewQueuedItem(item)
}

function presentActiveQueueItem(): void {
  const queue = useQueueStore.getState()
  const index = queue.activeIndex ?? 0
  const item = queue.items[index]
  if (!item) return

  queue.setActive(index)
  presentQueuedItem(item)
}

function advanceLiveHymnGroup(delta: number): boolean {
  const queue = useQueueStore.getState()
  const activeQueueItem =
    queue.activeIndex === null ? null : (queue.items[queue.activeIndex] ?? null)

  if (
    activeQueueItem?.presentation.kind === "hymn" &&
    activeQueueItem.hymnGroup
  ) {
    const activeGroup = activeQueueItem.hymnGroup
    const targetItemIndex = activeGroup.itemIndex + delta
    const targetQueueIndex = queue.items.findIndex((item) => {
      const group = item.hymnGroup
      return (
        item.presentation.kind === "hymn" &&
        group?.groupId === activeGroup.groupId &&
        group.itemIndex === targetItemIndex
      )
    })
    const target = queue.items[targetQueueIndex]
    if (target) {
      queue.setActive(targetQueueIndex)
      presentQueuedItem(target)
      return true
    }
  }
  return false
}

function presentOrPreview(
  next: Parameters<typeof presentItem>[0],
  isLive: boolean
): void {
  if (isLive) presentItem(next)
  else selectPreviewItem(next)
}

function advanceHymnDeck(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  restoreQueuedHymnDeckForRenderItem(targetItem)
  const hymnSlides = useHymnSlideStore.getState()
  if (hymnSlides.deck.length === 0) return false
  const deck = hymnDeckSlides(hymnSlides.deck)
  const currentIndex = findDeckIndex(
    deck,
    presentationDeckSlideId(targetItem),
    hymnSlides.activeIndex
  )
  const nextIndex = clampDeckIndex(deck.length, currentIndex, delta)
  const next = hymnSlides.deck[nextIndex]
  if (!next || nextIndex === currentIndex) return true
  hymnSlides.setDeck(hymnSlides.deck, nextIndex)
  presentOrPreview(next, isLive)
  return true
}

function advanceEgwDeck(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  const egwSlides = useEgwSlideStore.getState()
  if (egwSlides.deck.length === 0) return false
  const deck = egwDeckSlides(egwSlides.deck)
  const currentIndex = findDeckIndex(
    deck,
    presentationDeckSlideId(targetItem),
    egwSlides.activeIndex
  )
  const nextIndex = clampDeckIndex(deck.length, currentIndex, delta)
  const next = egwSlides.deck[nextIndex]
  if (!next || nextIndex === currentIndex) return true
  egwSlides.setDeck(egwSlides.deck, nextIndex)
  presentOrPreview(next, isLive)
  return true
}

function advanceSermonDeck(
  delta: number,
  targetItem: PresentationRenderData | null,
  isLive: boolean
): boolean {
  const sermonSlides = useSermonSlideStore.getState()
  if (sermonSlides.deck.length === 0) return false
  const deck = sermonDeckSlides(sermonSlides.deck)
  const currentIndex = findDeckIndex(
    deck,
    presentationDeckSlideId(targetItem),
    sermonSlides.activeIndex
  )
  const nextIndex = clampDeckIndex(deck.length, currentIndex, delta)
  const next = sermonSlides.deck[nextIndex]
  if (!next || nextIndex === currentIndex) return true
  sermonSlides.setDeck(sermonSlides.deck, nextIndex, sermonSlides.activeItemId)
  presentOrPreview(next, isLive)
  return true
}

function advancePresentationDeck(delta: number): boolean {
  const broadcast = useBroadcastStore.getState()
  const targetItem = broadcast.isLive
    ? broadcast.liveItem
    : broadcast.previewItem
  const deckKind = presentationDeckKind(targetItem)
  if (!deckKind) return false

  if (broadcast.isLive && deckKind === "hymn" && advanceLiveHymnGroup(delta)) {
    return true
  }
  if (deckKind === "hymn")
    return advanceHymnDeck(delta, targetItem, broadcast.isLive)
  if (deckKind === "egw")
    return advanceEgwDeck(delta, targetItem, broadcast.isLive)
  return advanceSermonDeck(delta, targetItem, broadcast.isLive)
}

function handleWorkspaceShortcut(key: string): boolean {
  if (key === "1") {
    useDashboardWorkspaceStore.getState().setWorkspace("live")
    useServicePlanStore.getState().closePlanner()
    return true
  }
  if (key === "2") {
    useDashboardWorkspaceStore.getState().setWorkspace("service-plans")
    useServicePlanStore.getState().openPlanner()
    return true
  }
  if (key === "3") {
    useDashboardWorkspaceStore.getState().setWorkspace("run-service")
    useServicePlanStore.getState().closePlanner()
    return true
  }
  if (key === "4") {
    useDashboardWorkspaceStore.getState().setWorkspace("hymns")
    useServicePlanStore.getState().closePlanner()
    return true
  }
  if (key === "5") {
    useDashboardWorkspaceStore.getState().setWorkspace("library")
    useServicePlanStore.getState().closePlanner()
    return true
  }
  return false
}

function handleArrowShortcut(event: KeyboardEvent): boolean {
  if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    if (event.key === "ArrowRight") return advancePresentationDeck(1)
    if (event.key === "ArrowLeft") return advancePresentationDeck(-1)
  }

  if (event.altKey && event.key === "ArrowRight") {
    void useServicePlanStore.getState().goToNextItem()
    return true
  }
  if (event.altKey && event.key === "ArrowLeft") {
    void useServicePlanStore.getState().goToPreviousItem()
    return true
  }
  if (event.altKey && event.key === "ArrowDown") {
    selectQueueItem(1)
    return true
  }
  if (event.altKey && event.key === "ArrowUp") {
    selectQueueItem(-1)
    return true
  }
  return false
}

function handleCommandShortcut(event: KeyboardEvent, key: string): boolean {
  const mod = event.ctrlKey || event.metaKey
  if (!mod) return false

  if (event.key === "Enter" && event.shiftKey) {
    presentActiveQueueItem()
    return true
  }
  if (event.key === "Enter") {
    commitPreviewToLive()
    return true
  }
  if (key === "l") {
    toggleLiveOutputVisibility()
    return true
  }
  if (event.shiftKey && key === "b") {
    blackoutOutput()
    return true
  }
  if (event.shiftKey && key === "x") {
    clearLiveOutput()
    return true
  }
  if (event.shiftKey && key === "p") {
    clearPreviewOutput()
    return true
  }
  if (key === "m") {
    toggleTranscription()
    return true
  }
  return false
}

export function useDashboardKeyboardControls(): void {
  useEffect(() => {
    window.addEventListener("keydown", handleDashboardKeyboardEvent)
    return () =>
      window.removeEventListener("keydown", handleDashboardKeyboardEvent)
  }, [])
}

export function handleDashboardKeyboardEvent(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.repeat || isEditableTarget(event.target))
    return
  if (useTutorialStore.getState().isRunning) return

  const key = event.key.toLowerCase()
  const mod = event.ctrlKey || event.metaKey
  const workspaceMod = mod || event.altKey

  if (workspaceMod && !event.shiftKey && handleWorkspaceShortcut(key)) {
    event.preventDefault()
    return
  }

  if (handleArrowShortcut(event)) {
    event.preventDefault()
    return
  }

  if (handleCommandShortcut(event, key)) {
    event.preventDefault()
  }
}
