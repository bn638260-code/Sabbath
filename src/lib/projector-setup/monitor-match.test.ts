import { describe, expect, it } from "vitest"
import {
  buildMonitorKey,
  type MonitorInfo,
} from "@/components/broadcast/broadcast-settings-wiring"
import { findExternalMonitor, matchRememberedMonitor } from "./monitor-match"
import type { RememberedSetup } from "./types"

function makeMonitor(
  overrides: Partial<MonitorInfo> &
    Pick<MonitorInfo, "name" | "width" | "height" | "x" | "y">,
): MonitorInfo {
  return { key: buildMonitorKey(overrides), ...overrides }
}

function rememberFrom(monitor: MonitorInfo, fullscreen = true): RememberedSetup {
  return {
    monitorKey: monitor.key,
    monitorName: monitor.name,
    width: monitor.width,
    height: monitor.height,
    fullscreen,
  }
}

describe("matchRememberedMonitor", () => {
  it("matches the remembered monitor by exact key", () => {
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

    expect(
      matchRememberedMonitor([internal, projector], rememberFrom(projector)),
    ).toEqual(projector)
  })

  it("matches by name and resolution when the projector reconnects at a new position", () => {
    const rememberedProjector = makeMonitor({
      name: "HDMI Projector",
      width: 1920,
      height: 1080,
      x: 1920,
      y: 0,
    })
    const internal = makeMonitor({
      name: "Internal Display",
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
    })
    // Same projector, but Windows placed it at a different offset this week,
    // so its geometry key differs from what we saved.
    const projectorNow = makeMonitor({
      name: "HDMI Projector",
      width: 1920,
      height: 1080,
      x: 2560,
      y: 0,
    })

    expect(
      matchRememberedMonitor(
        [internal, projectorNow],
        rememberFrom(rememberedProjector),
      ),
    ).toEqual(projectorNow)
  })

  it("returns null when the remembered projector is not present", () => {
    const internal = makeMonitor({
      name: "Internal Display",
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
    })
    const remembered = rememberFrom(
      makeMonitor({
        name: "HDMI Projector",
        width: 1920,
        height: 1080,
        x: 1920,
        y: 0,
      }),
    )

    expect(matchRememberedMonitor([internal], remembered)).toBeNull()
  })

  it("returns null when there is no remembered setup", () => {
    const internal = makeMonitor({
      name: "Internal Display",
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
    })

    expect(matchRememberedMonitor([internal], null)).toBeNull()
  })
})

describe("findExternalMonitor", () => {
  it("finds the external monitor as the one not at the origin", () => {
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

    expect(findExternalMonitor([internal, projector])).toEqual(projector)
  })

  it("returns null when only the primary display is present", () => {
    const internal = makeMonitor({
      name: "Internal Display",
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
    })

    expect(findExternalMonitor([internal])).toBeNull()
  })

  it("treats the last monitor as external when every monitor sits at the origin", () => {
    const internal = makeMonitor({
      name: "Internal Display",
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
    })
    const mirrored = makeMonitor({
      name: "HDMI Projector",
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
    })

    expect(findExternalMonitor([internal, mirrored])).toEqual(mirrored)
  })
})
