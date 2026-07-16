import { create } from "zustand"

export type ColorMode = "light"

export const COLOR_MODE_STORAGE_KEY = "sabbathcue-color-mode"

// The controller UI ships light-only (KNFC premium-light). The broadcast
// output window pins its own dark shell independently of this store.
function applyLightMode() {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.classList.add("light")
  root.classList.remove("dark")
}

interface ColorModeState {
  mode: ColorMode
  hydrate: () => void
}

export const useColorModeStore = create<ColorModeState>((set) => ({
  mode: "light",
  hydrate: () => {
    applyLightMode()
    set({ mode: "light" })
  },
}))
