import { describe, expect, it } from "vitest"
import { projectorReadinessCopy } from "./projector-readiness-copy"
import type { ProjectorReadiness } from "./projector-readiness"

const ALL_STATES: ProjectorReadiness[] = [
  "live",
  "ready-standby",
  "setup-changed",
  "possibly-duplicate-mode",
  "projector-not-detected",
  "no-remembered-setup",
]

describe("projectorReadinessCopy", () => {
  it("maps each readiness state to a chip tone and primary action kind", () => {
    expect(projectorReadinessCopy("live").primaryKind).toBe("hide")
    expect(projectorReadinessCopy("live").chipTone).toBe("live")

    expect(projectorReadinessCopy("ready-standby").primaryKind).toBe("restore")
    expect(projectorReadinessCopy("ready-standby").chipTone).toBe("ready")

    expect(projectorReadinessCopy("setup-changed").primaryKind).toBe("restore")
    expect(projectorReadinessCopy("setup-changed").chipTone).toBe("warn")

    expect(projectorReadinessCopy("possibly-duplicate-mode").primaryKind).toBe(
      "open-display-settings",
    )
    expect(projectorReadinessCopy("possibly-duplicate-mode").chipTone).toBe(
      "warn",
    )

    expect(projectorReadinessCopy("projector-not-detected").primaryKind).toBe(
      "none",
    )
    expect(projectorReadinessCopy("no-remembered-setup").chipTone).toBe(
      "neutral",
    )
  })

  it("provides non-empty chip label, title, body and primary label for every state", () => {
    for (const state of ALL_STATES) {
      const copy = projectorReadinessCopy(state)
      expect(copy.chipLabel.length).toBeGreaterThan(0)
      expect(copy.title.length).toBeGreaterThan(0)
      expect(copy.body.length).toBeGreaterThan(0)
      expect(copy.primaryLabel.length).toBeGreaterThan(0)
    }
  })

  it("tells duplicate-mode users to press Win+P and Extend", () => {
    expect(projectorReadinessCopy("possibly-duplicate-mode").body).toMatch(
      /Win\+P/i,
    )
  })
})
