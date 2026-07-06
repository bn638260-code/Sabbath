import { describe, expect, it } from "vitest"
import {
  buildMonitorKey,
  type MonitorInfo,
} from "@/components/broadcast/broadcast-settings-wiring"
import { deriveProjectorReadiness } from "./projector-readiness"
import type { RememberedSetup } from "./types"

function makeMonitor(
  overrides: Partial<MonitorInfo> &
    Pick<MonitorInfo, "name" | "width" | "height" | "x" | "y">,
): MonitorInfo {
  return { key: buildMonitorKey(overrides), ...overrides }
}

function rememberFrom(monitor: MonitorInfo): RememberedSetup {
  return {
    monitorKey: monitor.key,
    monitorName: monitor.name,
    width: monitor.width,
    height: monitor.height,
    fullscreen: true,
  }
}

const internal = makeMonitor({
  name: "Internal Display",
  width: 1920,
  height: 1080,
  x: 0,
  y: 0,
})
const projector = makeMonitor({
  name: "HDMI Projector",
  width: 1920,
  height: 1080,
  x: 1920,
  y: 0,
})

describe("deriveProjectorReadiness", () => {
  it("is live when an output is already on air", () => {
    expect(
      deriveProjectorReadiness({
        monitors: [internal, projector],
        remembered: rememberFrom(projector),
        isLive: true,
      }),
    ).toBe("live")
  })

  it("is ready-standby when the remembered projector is connected", () => {
    expect(
      deriveProjectorReadiness({
        monitors: [internal, projector],
        remembered: rememberFrom(projector),
        isLive: false,
      }),
    ).toBe("ready-standby")
  })

  it("is setup-changed when the remembered screen is gone but another external is present", () => {
    const conferenceTv = makeMonitor({
      name: "Conference TV",
      width: 1920,
      height: 1080,
      x: 1920,
      y: 0,
    })
    expect(
      deriveProjectorReadiness({
        monitors: [internal, conferenceTv],
        remembered: rememberFrom(projector),
        isLive: false,
      }),
    ).toBe("setup-changed")
  })

  it("is projector-not-detected when a projector is remembered but only the main screen is present", () => {
    expect(
      deriveProjectorReadiness({
        monitors: [internal],
        remembered: rememberFrom(projector),
        isLive: false,
      }),
    ).toBe("projector-not-detected")
  })

  it("is possibly-duplicate-mode when two monitors report identical geometry", () => {
    const mirrored = makeMonitor({
      name: "HDMI Projector",
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
    })
    expect(
      deriveProjectorReadiness({
        monitors: [internal, mirrored],
        remembered: rememberFrom(mirrored),
        isLive: false,
      }),
    ).toBe("possibly-duplicate-mode")
  })

  it("is no-remembered-setup when the volunteer has never configured a projector", () => {
    expect(
      deriveProjectorReadiness({
        monitors: [internal, projector],
        remembered: null,
        isLive: false,
      }),
    ).toBe("no-remembered-setup")
  })

  it("is no-remembered-setup on a fresh machine with nothing external connected", () => {
    expect(
      deriveProjectorReadiness({
        monitors: [internal],
        remembered: null,
        isLive: false,
      }),
    ).toBe("no-remembered-setup")
  })
})
