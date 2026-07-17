import { create } from "zustand"

export type AccentTheme = "teal" | "gold" | "emerald" | "purple" | "aurora"

export const ACCENT_THEME_STORAGE_KEY = "sabbathcue-accent-theme"

interface AccentThemeState {
  theme: AccentTheme
  setTheme: (theme: AccentTheme) => void
  hydrate: () => void
}

// The KNFC premium-light interface ships with a single gold accent; the
// picker was removed from the header, and hydrate ignores any stored value
// so installs that previously chose another accent land on gold too.
export const useAccentThemeStore = create<AccentThemeState>((set) => ({
  theme: "gold",
  setTheme: (theme) => {
    try {
      localStorage.setItem(ACCENT_THEME_STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
    set({ theme })
  },
  hydrate: () => set({ theme: "gold" }),
}))

export function accentThemeClassName(theme: AccentTheme): string {
  return `theme-${theme}`
}
