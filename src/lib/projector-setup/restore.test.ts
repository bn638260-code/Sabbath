import { describe, expect, it } from "vitest"
import {
  buildMonitorKey,
  type MonitorInfo,
} from "@/components/broadcast/broadcast-settings-wiring"
import { resolveRestoreTargetKey } from "./restore"
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

describe("resolveRestoreTargetKey", () => {
  it("targets the remembered projector when it is connected", () => {
    expect(
      resolveRestoreTargetKey([internal, projector], rememberFrom(projector)),
    ).toBe(projector.key)
  })

  it("falls back to another external screen when the remembered one is gone", () => {
    const conferenceTv = makeMonitor({
      name: "Conference TV",
      width: 1920,
      height: 1080,
      x: 1920,
      y: 0,
    })
    expect(
      resolveRestoreTargetKey([internal, conferenceTv], rememberFrom(projector)),
    ).toBe(conferenceTv.key)
  })

  it("auto-targets the external screen for a first-time setup", () => {
    expect(resolveRestoreTargetKey([internal, projector], null)).toBe(
      projector.key,
    )
  })

  it("returns null when there is no external screen to target", () => {
    expect(resolveRestoreTargetKey([internal], rememberFrom(projector))).toBeNull()
  })
})
