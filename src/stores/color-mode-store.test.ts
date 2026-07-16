import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  COLOR_MODE_STORAGE_KEY,
  useColorModeStore,
  type ColorMode,
} from "./color-mode-store"

function makeClassList() {
  const classes = new Set<string>()
  return {
    contains: (name: string) => classes.has(name),
    toggle: (name: string, force?: boolean) => {
      const shouldAdd = force ?? !classes.has(name)
      if (shouldAdd) classes.add(name)
      else classes.delete(name)
      return shouldAdd
    },
    clear: () => classes.clear(),
  }
}

const classList = makeClassList()
const storage = new Map<string, string>()

function resetStore(mode: ColorMode = "dark") {
  classList.clear()
  storage.clear()
  vi.stubGlobal("document", {
    documentElement: {
      classList,
    },
  })
  vi.stubGlobal("localStorage", {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
  useColorModeStore.setState({
    mode,
  })
}

describe("color mode store", () => {
  beforeEach(() => {
    resetStore()
  })

  it("hydrates to light by default", () => {
    useColorModeStore.getState().hydrate()

    expect(useColorModeStore.getState().mode).toBe("light")
    expect(classList.contains("light")).toBe(true)
    expect(classList.contains("dark")).toBe(false)
  })

  it("sets and persists dark mode", () => {
    useColorModeStore.getState().setMode("dark")

    expect(storage.get(COLOR_MODE_STORAGE_KEY)).toBe("dark")
    expect(useColorModeStore.getState().mode).toBe("dark")
    expect(classList.contains("dark")).toBe(true)
    expect(classList.contains("light")).toBe(false)
  })

  it("toggles between light and dark", () => {
    useColorModeStore.getState().hydrate()

    useColorModeStore.getState().toggle()
    expect(useColorModeStore.getState().mode).toBe("dark")

    useColorModeStore.getState().toggle()
    expect(useColorModeStore.getState().mode).toBe("light")
  })

  it("hydrates a persisted mode", () => {
    storage.set(COLOR_MODE_STORAGE_KEY, "dark")

    useColorModeStore.getState().hydrate()

    expect(useColorModeStore.getState().mode).toBe("dark")
    expect(classList.contains("dark")).toBe(true)
  })

  it("falls back to light when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("storage disabled")
      },
      setItem: () => undefined,
    })

    useColorModeStore.getState().hydrate()

    expect(useColorModeStore.getState().mode).toBe("light")
    expect(classList.contains("light")).toBe(true)
  })
})
