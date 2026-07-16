// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useAccentThemeStore } from "@/stores/accent-theme-store"
import { useColorModeStore } from "@/stores/color-mode-store"
import { AppControllerHeader } from "./app-controller-header"

function renderHeader() {
  return render(
    <TooltipProvider>
      <AppControllerHeader />
    </TooltipProvider>,
  )
}

describe("AppControllerHeader color mode controls", () => {
  beforeEach(() => {
    document.documentElement.className = ""
    localStorage.clear()
    useAccentThemeStore.setState({ theme: "teal" })
    useColorModeStore.getState().hydrate()
  })

  afterEach(() => {
    cleanup()
  })

  it("ships light-only: no dark mode toggle is rendered", () => {
    renderHeader()

    expect(useColorModeStore.getState().mode).toBe("light")
    expect(document.documentElement.classList.contains("light")).toBe(true)
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    expect(
      screen.queryByRole("button", { name: /switch to (dark|light) mode/i }),
    ).toBeNull()
  })

  it("shows accent swatches", () => {
    renderHeader()

    expect(screen.getByText("Theme:")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Soft Teal" })).toBeTruthy()
  })
})
