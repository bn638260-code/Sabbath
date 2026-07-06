import { describe, expect, it } from "vitest"
import {
  buildMonitorKey,
  buildOpenBroadcastWindowArgs,
  clampMonitorIndex,
  normalizeMonitorList,
  resolveMonitorIndexFromKey,
  shouldPersistResolvedMonitorKey,
  type MonitorInfo,
} from "./broadcast-settings-wiring"

function makeMonitor(
  overrides: Partial<MonitorInfo> & Pick<MonitorInfo, "name" | "width" | "height" | "x" | "y">,
): MonitorInfo {
  const key = buildMonitorKey(overrides)
  return {
    key,
    ...overrides,
  }
}

describe("broadcast settings wiring", () => {
  it("builds main projector command args from the selected monitor key", () => {
    const monitors = [
      makeMonitor({ name: "HDMI-1", width: 1920, height: 1080, x: 0, y: 0 }),
      makeMonitor({ name: "HDMI-2", width: 1280, height: 720, x: 1920, y: 0 }),
    ]

    expect(
      buildOpenBroadcastWindowArgs("main", monitors, monitors[1].key, 0, true),
    ).toEqual({
      outputId: "main",
      monitorIndex: 1,
      monitorKey: monitors[1].key,
      fullscreen: true,
    })
  })

  it("targets an HDMI screen extended to the right of the laptop display", () => {
    const monitors = [
      makeMonitor({ name: "Internal Display", width: 1920, height: 1080, x: 0, y: 0 }),
      makeMonitor({ name: "HDMI Projector", width: 1920, height: 1080, x: 1920, y: 0 }),
    ]

    expect(
      buildOpenBroadcastWindowArgs("main", monitors, monitors[1].key, 0, true),
    ).toEqual({
      outputId: "main",
      monitorIndex: 1,
      monitorKey: "hdmi projector|1920x1080|1920,0",
      fullscreen: true,
    })
  })

  it("targets an HDMI screen extended to the left with negative desktop coordinates", () => {
    const monitors = [
      makeMonitor({ name: "HDMI Projector", width: 1280, height: 720, x: -1280, y: 0 }),
      makeMonitor({ name: "Internal Display", width: 1920, height: 1080, x: 0, y: 0 }),
    ]

    expect(
      buildOpenBroadcastWindowArgs("main", monitors, monitors[0].key, 1, true),
    ).toEqual({
      outputId: "main",
      monitorIndex: 0,
      monitorKey: "hdmi projector|1280x720|-1280,0",
      fullscreen: true,
    })
  })

  it("resolves a reordered monitor array by stable key", () => {
    const monitors = [
      makeMonitor({ name: "HDMI-2", width: 1280, height: 720, x: 1920, y: 0 }),
      makeMonitor({ name: "HDMI-1", width: 1920, height: 1080, x: 0, y: 0 }),
    ]
    const selectedKey = buildMonitorKey({
      name: "HDMI-1",
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
    })

    expect(resolveMonitorIndexFromKey(monitors, selectedKey, 0)).toBe(1)
  })

  it("falls back to the saved index when the key is missing", () => {
    const monitors = [
      makeMonitor({ name: "HDMI-1", width: 1920, height: 1080, x: 0, y: 0 }),
      makeMonitor({ name: "HDMI-2", width: 1280, height: 720, x: 1920, y: 0 }),
    ]

    expect(resolveMonitorIndexFromKey(monitors, "missing-key", 1)).toBe(1)
  })

  it("preserves a remembered projector key when refresh falls back to another monitor", () => {
    const monitors = [
      makeMonitor({ name: "Internal Display", width: 1920, height: 1080, x: 0, y: 0 }),
    ]

    expect(shouldPersistResolvedMonitorKey(monitors, "projector|1920x1080|1920,0")).toBe(false)
    expect(shouldPersistResolvedMonitorKey(monitors, monitors[0].key)).toBe(true)
    expect(shouldPersistResolvedMonitorKey(monitors, "")).toBe(true)
  })

  it("falls back to the primary monitor for invalid persisted selections", () => {
    expect(
      buildOpenBroadcastWindowArgs("main", [], "missing", 0, true),
    ).toEqual({
      outputId: "main",
      monitorIndex: 0,
      monitorKey: "missing",
      fullscreen: true,
    })
  })

  it("clamps saved monitor indexes to the available monitor range", () => {
    expect(clampMonitorIndex(3, 2)).toBe(1)
    expect(clampMonitorIndex(1, 2)).toBe(1)
    expect(clampMonitorIndex(0, 0)).toBe(0)
    expect(clampMonitorIndex(-1, 2)).toBe(0)
    expect(clampMonitorIndex(Number.NaN, 2)).toBe(0)
  })

  it("suffixes duplicate monitor keys internally", () => {
    const monitors = normalizeMonitorList([
      makeMonitor({ name: "Display", width: 1920, height: 1080, x: 0, y: 0 }),
      makeMonitor({ name: "Display", width: 1920, height: 1080, x: 0, y: 0 }),
    ])

    expect(monitors[0].key).not.toBe(monitors[1].key)
    expect(monitors[1].name).toContain("(2)")
  })
})
