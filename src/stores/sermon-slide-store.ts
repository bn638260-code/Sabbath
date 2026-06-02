import { create } from "zustand"
import type { SlideDeckPresentationItemData } from "@/types"

interface SermonSlideState {
  activeItemId: string | null
  deck: SlideDeckPresentationItemData[]
  activeIndex: number
  setDeck: (
    deck: SlideDeckPresentationItemData[],
    activeIndex: number,
    activeItemId: string | null,
  ) => void
  clear: () => void
}

export const useSermonSlideStore = create<SermonSlideState>((set) => ({
  activeItemId: null,
  deck: [],
  activeIndex: 0,
  setDeck: (deck, activeIndex, activeItemId) => {
    const safeIndex = Number.isFinite(activeIndex) ? activeIndex : 0
    set({
      deck,
      activeItemId,
      activeIndex: Math.max(0, Math.min(deck.length - 1, safeIndex)),
    })
  },
  clear: () => set({ activeItemId: null, deck: [], activeIndex: 0 }),
}))
