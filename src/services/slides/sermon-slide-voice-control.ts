import { presentSermonSlideAt } from "@/services/slides/sermon-slide-live"
import { buildSermonSlideDeck } from "@/services/slides/sermon-slide-deck"
import { useSermonSlideStore } from "@/stores/sermon-slide-store"
import { useServicePlanStore } from "@/stores/service-plan-store"

export type SermonSlideCommand =
  | { kind: "next" }
  | { kind: "previous" }
  | { kind: "jump"; slideNumber: number }

const SLIDE_JUMP_PATTERN = /\b(?:go\s+to\s+)?slide\s+(?:number\s+)?(\d{1,3})\b/i
const NEXT_SLIDE_PATTERN = /\b(?:next|advance)\s+slide\b/i
const PREVIOUS_SLIDE_PATTERN = /\b(?:previous|prev|back|go\s+back)\s+slide\b/i

export function parseSermonSlideCommand(text: string): SermonSlideCommand | null {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return null

  const jump = normalized.match(SLIDE_JUMP_PATTERN)
  if (jump) {
    const slideNumber = Number.parseInt(jump[1], 10)
    if (Number.isInteger(slideNumber) && slideNumber > 0) {
      return { kind: "jump", slideNumber }
    }
  }

  if (NEXT_SLIDE_PATTERN.test(normalized)) return { kind: "next" }
  if (PREVIOUS_SLIDE_PATTERN.test(normalized)) return { kind: "previous" }

  return null
}

function activeServiceItem() {
  const plan = useServicePlanStore.getState().activePlan
  if (!plan?.activeItemId) return null
  return plan.items.find((item) => item.id === plan.activeItemId) ?? null
}

export function handleSermonSlideVoiceControl(text: string): boolean {
  const command = parseSermonSlideCommand(text)
  if (!command) return false

  const item = activeServiceItem()
  if (!item) return false

  const deck = buildSermonSlideDeck(item)
  if (deck.length === 0) return false

  const current = useSermonSlideStore.getState()
  const currentIndex =
    current.activeItemId === item.id
      ? Math.max(0, Math.min(deck.length - 1, current.activeIndex))
      : 0

  const targetIndex =
    command.kind === "jump"
      ? command.slideNumber - 1
      : command.kind === "next"
        ? currentIndex + 1
        : currentIndex - 1

  return presentSermonSlideAt(targetIndex)
}
