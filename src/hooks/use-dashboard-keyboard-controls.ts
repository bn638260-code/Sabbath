import { useEffect } from "react"
import {
  commitPreviewToLive,
  presentItem,
  selectPreviewItem,
} from "@/lib/presentation-workflow"
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
  selectPreviewItem(item.presentation)
}

function presentActiveQueueItem(): void {
  const queue = useQueueStore.getState()
  const index = queue.activeIndex ?? 0
  const item = queue.items[index]
  if (!item) return

  queue.setActive(index)
  presentItem(item.presentation)
}

function advancePresentationDeck(delta: number): boolean {
  const broadcast = useBroadcastStore.getState()
  const previewItem = broadcast.previewItem
  const liveItem = broadcast.liveItem
  const targetItem = broadcast.isLive ? liveItem : previewItem
  const deckKind = presentationDeckKind(targetItem)
  if (!deckKind) return false
  const isLive = broadcast.isLive

  const queue = useQueueStore.getState()
  const activeQueueItem =
    queue.activeIndex === null ? null : (queue.items[queue.activeIndex] ?? null)

  if (
    isLive &&
    deckKind === "hymn" &&
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
      presentItem(target.presentation)
      return true
    }
  }

  if (deckKind === "hymn") {
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
    if (isLive) presentItem(next)
    else selectPreviewItem(next)
    return true
  }

  if (deckKind === "egw") {
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
    if (isLive) presentItem(next)
    else selectPreviewItem(next)
    return true
  }

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
  if (isLive) presentItem(next)
  else selectPreviewItem(next)
  return true
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

  if (workspaceMod && !event.shiftKey && key === "1") {
    event.preventDefault()
    useDashboardWorkspaceStore.getState().setWorkspace("live")
    useServicePlanStore.getState().closePlanner()
    return
  }

  if (workspaceMod && !event.shiftKey && key === "2") {
    event.preventDefault()
    useDashboardWorkspaceStore.getState().setWorkspace("service-plans")
    useServicePlanStore.getState().openPlanner()
    return
  }

  if (workspaceMod && !event.shiftKey && key === "3") {
    event.preventDefault()
    useDashboardWorkspaceStore.getState().setWorkspace("run-service")
    useServicePlanStore.getState().closePlanner()
    return
  }

  if (workspaceMod && !event.shiftKey && key === "4") {
    event.preventDefault()
    useDashboardWorkspaceStore.getState().setWorkspace("hymns")
    useServicePlanStore.getState().closePlanner()
    return
  }

  if (!mod && !event.altKey && !event.shiftKey && event.key === "ArrowRight") {
    if (advancePresentationDeck(1)) event.preventDefault()
    return
  }

  if (!mod && !event.altKey && !event.shiftKey && event.key === "ArrowLeft") {
    if (advancePresentationDeck(-1)) event.preventDefault()
    return
  }

  if (mod && event.key === "Enter" && event.shiftKey) {
    event.preventDefault()
    presentActiveQueueItem()
    return
  }

  if (mod && event.key === "Enter") {
    event.preventDefault()
    commitPreviewToLive()
    return
  }

  if (mod && key === "l") {
    event.preventDefault()
    toggleLiveOutputVisibility()
    return
  }

  if (mod && event.shiftKey && key === "b") {
    event.preventDefault()
    blackoutOutput()
    return
  }

  if (mod && event.shiftKey && key === "x") {
    event.preventDefault()
    clearLiveOutput()
    return
  }

  if (mod && event.shiftKey && key === "p") {
    event.preventDefault()
    clearPreviewOutput()
    return
  }

  if (mod && key === "m") {
    event.preventDefault()
    toggleTranscription()
    return
  }

  if (event.altKey && event.key === "ArrowRight") {
    event.preventDefault()
    void useServicePlanStore.getState().goToNextItem()
    return
  }

  if (event.altKey && event.key === "ArrowLeft") {
    event.preventDefault()
    void useServicePlanStore.getState().goToPreviousItem()
    return
  }

  if (event.altKey && event.key === "ArrowDown") {
    event.preventDefault()
    selectQueueItem(1)
    return
  }

  if (event.altKey && event.key === "ArrowUp") {
    event.preventDefault()
    selectQueueItem(-1)
  }
}
