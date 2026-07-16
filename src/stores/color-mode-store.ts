import { create } from "zustand"

export type ColorMode = "light" | "dark"

export const COLOR_MODE_STORAGE_KEY = "sabbathcue-color-mode"

function isColorMode(value: string | null): value is ColorMode {
  return value === "light" || value === "dark"
}

function applyMode(mode: ColorMode) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.classList.toggle("light", mode === "light")
  root.classList.toggle("dark", mode === "dark")
}

function readStoredMode(): ColorMode {
  try {
    const raw = localStorage.getItem(COLOR_MODE_STORAGE_KEY)
    if (isColorMode(raw)) return raw
  } catch {
    /* private browsing / disabled storage */
  }
  return "light"
}

interface ColorModeState {
  mode: ColorMode
  setMode: (mode: ColorMode) => void
  toggle: () => void
  hydrate: () => void
}

export const useColorModeStore = create<ColorModeState>((set, get) => ({
  mode: "light",
  setMode: (mode) => {
    try {
      localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode)
    } catch {
      /* ignore */
    }
    applyMode(mode)
    set({ mode })
  },
  toggle: () => {
    get().setMode(get().mode === "dark" ? "light" : "dark")
  },
  hydrate: () => {
    const mode = readStoredMode()
    applyMode(mode)
    set({ mode })
  },
}))
