import { describe, expect, it } from "vitest"
import { audioOutputScanLabel } from "./audio-output-devices"

describe("audioOutputScanLabel", () => {
  it("describes unavailable, loading, empty, and multiple output states", () => {
    expect(
      audioOutputScanLabel({
        canRouteAudio: false,
        loading: false,
        devices: [],
      })
    ).toBe("Routing unavailable")
    expect(
      audioOutputScanLabel({
        canRouteAudio: true,
        loading: true,
        devices: [],
      })
    ).toBe("Scanning outputs")
    expect(
      audioOutputScanLabel({
        canRouteAudio: true,
        loading: false,
        devices: [],
      })
    ).toBe("No outputs found")
    expect(
      audioOutputScanLabel({
        canRouteAudio: true,
        loading: false,
        devices: [
          { deviceId: "default", label: "Default" },
          { deviceId: "speaker", label: "Speaker" },
        ],
      })
    ).toBe("2 outputs found")
  })
})
