import { beforeEach, describe, expect, it, vi } from "vitest"
import { useColorModeStore } from "./color-mode-store"

function makeClassList() {
  const classes = new Set<string>()
  return {
    contains: (name: string) => classes.has(name),
    add: (name: string) => classes.add(name),
    remove: (name: string) => classes.delete(name),
    clear: () => classes.clear(),
  }
}

const classList = makeClassList()

describe("color mode store (light-only controller)", () => {
  beforeEach(() => {
    classList.clear()
    vi.stubGlobal("document", {
      documentElement: {
        classList,
      },
    })
    useColorModeStore.setState({ mode: "light" })
  })

  it("hydrates to light and strips any stale dark class", () => {
    classList.add("dark")

    useColorModeStore.getState().hydrate()

    expect(useColorModeStore.getState().mode).toBe("light")
    expect(classList.contains("light")).toBe(true)
    expect(classList.contains("dark")).toBe(false)
  })
})
