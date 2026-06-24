import { describe, expect, it } from "vitest"
import {
  broadcastOutputBlockedReason,
  canEnableBroadcastOutput,
} from "./broadcast-output-readiness"

describe("broadcast output readiness", () => {
  it("allows display output when at least one monitor is available", () => {
    expect(
      canEnableBroadcastOutput(
        { enabled: false, outputType: "display", ndiActive: false },
        [{ key: "m1", name: "Display", width: 1920, height: 1080, x: 0, y: 0 }],
        false,
      ),
    ).toBe(true)
  })

  it("blocks display output when no monitors are detected", () => {
    expect(
      canEnableBroadcastOutput(
        { enabled: false, outputType: "display", ndiActive: false },
        [],
        false,
      ),
    ).toBe(false)
    expect(
      broadcastOutputBlockedReason(
        { enabled: false, outputType: "display", ndiActive: false },
        [],
        false,
      ),
    ).toContain("display")
  })

  it("blocks inactive NDI output as coming soon", () => {
    expect(
      canEnableBroadcastOutput(
        { enabled: false, outputType: "ndi", ndiActive: false },
        [],
        true,
      ),
    ).toBe(false)
    expect(
      broadcastOutputBlockedReason(
        { enabled: false, outputType: "ndi", ndiActive: false },
        [],
        true,
      ),
    ).toContain("coming soon")
  })

  it("blocks stale active NDI state while the feature is coming soon", () => {
    expect(
      canEnableBroadcastOutput(
        { enabled: false, outputType: "ndi", ndiActive: true },
        [{ key: "m1", name: "Display", width: 1920, height: 1080, x: 0, y: 0 }],
        true,
      ),
    ).toBe(false)
    expect(
      broadcastOutputBlockedReason(
        { enabled: false, outputType: "ndi", ndiActive: true },
        [{ key: "m1", name: "Display", width: 1920, height: 1080, x: 0, y: 0 }],
        true,
      ),
    ).toContain("coming soon")
  })
})
