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
    useAccentThemeStore.getState().hydrate()
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

  it("pins the gold accent: no theme picker is rendered", () => {
    renderHeader()

    expect(useAccentThemeStore.getState().theme).toBe("gold")
    expect(screen.queryByText("Theme:")).toBeNull()
    expect(screen.queryByRole("button", { name: "Soft Teal" })).toBeNull()
  })

  it("renders the Special Edition collector's mark with the app version", () => {
    renderHeader()

    const editionStamp = screen.getByLabelText(/^Special Edition v[0-9]/)

    expect(editionStamp).toBeTruthy()
    expect(editionStamp.className).toContain("h-[18px]")
    expect(editionStamp.className).not.toContain("h-4")
    expect(editionStamp.className).not.toContain("h-7")
    expect(editionStamp.parentElement?.dataset.slot).toBe("product-wordmark")
    expect(editionStamp.querySelector("svg")).toBeNull()
    expect(screen.getByText("Special")).toBeTruthy()
    expect(screen.getByText("Edition")).toBeTruthy()
  })
})
