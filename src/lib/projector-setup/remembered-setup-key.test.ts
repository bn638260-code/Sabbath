import { describe, expect, it } from "vitest"
import { buildMonitorKey } from "@/components/broadcast/broadcast-settings-wiring"
import { parseRememberedSetupKey } from "./remembered-setup-key"

describe("parseRememberedSetupKey", () => {
  it("reconstructs a remembered setup from the persisted monitor key", () => {
    const key = buildMonitorKey({
      name: "HDMI Projector",
      width: 1920,
      height: 1080,
      x: 1920,
      y: 0,
    })

    expect(parseRememberedSetupKey(key, true)).toEqual({
      monitorKey: key,
      monitorName: "hdmi projector",
      width: 1920,
      height: 1080,
      fullscreen: true,
    })
  })

  it("carries the fullscreen preference through", () => {
    const key = buildMonitorKey({
      name: "Sanctuary TV",
      width: 1280,
      height: 720,
      x: -1280,
      y: 0,
    })

    expect(parseRememberedSetupKey(key, false)?.fullscreen).toBe(false)
  })

  it("returns null for an empty or malformed key", () => {
    expect(parseRememberedSetupKey("", true)).toBeNull()
    expect(parseRememberedSetupKey("not-a-real-key", true)).toBeNull()
  })
})
