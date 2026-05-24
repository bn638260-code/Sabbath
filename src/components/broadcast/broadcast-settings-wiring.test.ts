import { describe, expect, it } from "vitest"
import {
  buildOpenBroadcastWindowArgs,
  clampMonitorIndex,
} from "./broadcast-settings-wiring"

describe("broadcast settings wiring", () => {
  it("builds main projector command args from the selected monitor and fullscreen state", () => {
    expect(buildOpenBroadcastWindowArgs("main", "2", true)).toEqual({
      outputId: "main",
      monitorIndex: 2,
      fullscreen: true,
    })
  })

  it("builds alternate projector command args without changing the output id", () => {
    expect(buildOpenBroadcastWindowArgs("alt", "1", false)).toEqual({
      outputId: "alt",
      monitorIndex: 1,
      fullscreen: false,
    })
  })

  it("clamps saved monitor indexes to the available monitor range", () => {
    expect(clampMonitorIndex(3, 2)).toBe(1)
    expect(clampMonitorIndex(1, 2)).toBe(1)
    expect(clampMonitorIndex(0, 0)).toBe(0)
    expect(clampMonitorIndex(-1, 2)).toBe(0)
    expect(clampMonitorIndex(Number.NaN, 2)).toBe(0)
  })

  it("falls back to the primary monitor for invalid persisted selections", () => {
    expect(buildOpenBroadcastWindowArgs("main", "missing", true)).toEqual({
      outputId: "main",
      monitorIndex: 0,
      fullscreen: true,
    })
  })
})
