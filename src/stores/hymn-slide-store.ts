import { create } from "zustand"
import type { HymnPresentationItemData } from "@/types"

interface HymnSlideState {
  deck: HymnPresentationItemData[]
  activeIndex: number
  setDeck: (deck: HymnPresentationItemData[], activeIndex: number) => void
}

export const useHymnSlideStore = create<HymnSlideState>((set) => ({
  deck: [],
  activeIndex: 0,
  setDeck: (deck, activeIndex) => {
    const safeIndex = Number.isFinite(activeIndex) ? activeIndex : 0
    set({
      deck,
      activeIndex: Math.max(0, Math.min(deck.length - 1, safeIndex)),
    })
  },
}))
