import { describe, expect, it, vi } from "vitest"
import { applyPanelFullscreen } from "./live-output-panel-fullscreen"

describe("live output panel fullscreen wiring", () => {
  it("applies the fullscreen layout before the window request resolves", async () => {
    // Regression: the layout used to flip only after the fullscreen change,
    // so the panel painted a frame of windowed chrome at fullscreen size —
    // the enter/exit flash.
    const layoutChanges: boolean[] = []
    let layoutAtRequestTime: boolean | undefined
    const setFullscreen = vi.fn().mockImplementation(() => {
      layoutAtRequestTime = layoutChanges.at(-1)
      return Promise.resolve()
    })

    await applyPanelFullscreen(true, { setFullscreen }, (fullscreen) => {
      layoutChanges.push(fullscreen)
    })

    expect(setFullscreen).toHaveBeenCalledWith(true)
    expect(layoutAtRequestTime).toBe(true)
    expect(layoutChanges).toEqual([true])
  })

  it("applies the windowed layout before exit resolves", async () => {
    const layoutChanges: boolean[] = []
    let layoutAtExitTime: boolean | undefined
    const setFullscreen = vi.fn().mockImplementation(() => {
      layoutAtExitTime = layoutChanges.at(-1)
      return Promise.resolve()
    })

    await applyPanelFullscreen(false, { setFullscreen }, (fullscreen) => {
      layoutChanges.push(fullscreen)
    })

    expect(setFullscreen).toHaveBeenCalledWith(false)
    expect(layoutAtExitTime).toBe(false)
    expect(layoutChanges).toEqual([false])
  })

  it("rolls the optimistic layout back when the window request fails", async () => {
    const layoutChanges: boolean[] = []
    const setFullscreen = vi.fn().mockRejectedValue(new Error("denied"))

    await expect(
      applyPanelFullscreen(true, { setFullscreen }, (fullscreen) => {
        layoutChanges.push(fullscreen)
      }),
    ).rejects.toThrow("denied")

    expect(layoutChanges).toEqual([true, false])
  })
})
