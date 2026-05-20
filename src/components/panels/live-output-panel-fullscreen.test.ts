import { describe, expect, it, vi } from "vitest"
import { isPanelFullscreen, togglePanelFullscreen } from "./live-output-panel-fullscreen"

describe("live output panel fullscreen wiring", () => {
  it("only reports fullscreen when the live panel itself owns fullscreen", () => {
    const panel = { id: "live-panel" } as unknown as Element
    const otherElement = { id: "other" } as unknown as Element

    expect(isPanelFullscreen(panel, panel)).toBe(true)
    expect(isPanelFullscreen(panel, otherElement)).toBe(false)
    expect(isPanelFullscreen(panel, null)).toBe(false)
    expect(isPanelFullscreen(null, panel)).toBe(false)
  })

  it("requests fullscreen on the live panel when it is not already fullscreen", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    const exitFullscreen = vi.fn().mockResolvedValue(undefined)
    const panel = { requestFullscreen } as unknown as HTMLElement

    await togglePanelFullscreen(panel, null, exitFullscreen)

    expect(requestFullscreen).toHaveBeenCalledTimes(1)
    expect(exitFullscreen).not.toHaveBeenCalled()
  })

  it("exits fullscreen when the live panel is already fullscreen", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    const exitFullscreen = vi.fn().mockResolvedValue(undefined)
    const panel = { requestFullscreen } as unknown as HTMLElement

    await togglePanelFullscreen(panel, panel, exitFullscreen)

    expect(exitFullscreen).toHaveBeenCalledTimes(1)
    expect(requestFullscreen).not.toHaveBeenCalled()
  })
})

