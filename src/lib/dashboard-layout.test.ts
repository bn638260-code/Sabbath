import { describe, expect, it } from "vitest"
import {
  DASHBOARD_LAYOUT_PRESETS,
  clampNumber,
  type DashboardViewMode,
} from "./dashboard-layout"

describe("dashboard layout helpers", () => {
  it("clamps values to the configured range", () => {
    expect(clampNumber(10, 20, 40)).toBe(20)
    expect(clampNumber(30, 20, 40)).toBe(30)
    expect(clampNumber(50, 20, 40)).toBe(40)
  })

  it("defines complete presets for every view mode", () => {
    const modes: DashboardViewMode[] = ["balanced", "broadcast", "study"]

    for (const mode of modes) {
      const preset = DASHBOARD_LAYOUT_PRESETS[mode]
      expect(preset.topHeightPercent).toBeGreaterThanOrEqual(34)
      expect(preset.topHeightPercent).toBeLessThanOrEqual(68)
      expect(preset.transcriptWidth).toBeGreaterThanOrEqual(240)
      expect(preset.queueWidth).toBeGreaterThanOrEqual(240)
      expect(preset.detectionsWidth).toBeGreaterThanOrEqual(360)
    }
  })
})

