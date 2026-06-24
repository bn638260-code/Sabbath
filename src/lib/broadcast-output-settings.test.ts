import { describe, expect, it } from "vitest"
import {
  buildNdiConfigPayload,
  buildNdiStartRequest,
  getBroadcastWindowLabel,
  getDefaultOutputSettings,
  ndiFrameRateToNumber,
  resolveNdiDimensions,
} from "./broadcast-output-settings"
import { DEFAULT_NDI_ALT_SOURCE_NAME, DEFAULT_NDI_SOURCE_NAME } from "@/lib/app-brand"

describe("broadcast-output-settings", () => {
  describe("ndiFrameRateToNumber", () => {
    it("maps frame rate enums to numeric fps", () => {
      expect(ndiFrameRateToNumber("fps24")).toBe(24)
      expect(ndiFrameRateToNumber("fps30")).toBe(30)
      expect(ndiFrameRateToNumber("fps60")).toBe(60)
    })
  })

  describe("getBroadcastWindowLabel", () => {
    it("returns the main broadcast window label", () => {
      expect(getBroadcastWindowLabel("main")).toBe("broadcast")
    })

    it("returns the alternate broadcast window label", () => {
      expect(getBroadcastWindowLabel("alt")).toBe("broadcast-alt")
    })
  })

  describe("resolveNdiDimensions", () => {
    it("resolves standard NDI output dimensions", () => {
      expect(resolveNdiDimensions("r720p")).toEqual({ width: 1280, height: 720 })
      expect(resolveNdiDimensions("r1080p")).toEqual({ width: 1920, height: 1080 })
      expect(resolveNdiDimensions("r4k")).toEqual({ width: 3840, height: 2160 })
    })
  })

  describe("buildNdiConfigPayload", () => {
    it("builds inactive config payloads with dimensions and fps", () => {
      expect(buildNdiConfigPayload(false, "fps30", "r720p")).toEqual({
        active: false,
        fps: 30,
        width: 1280,
        height: 720,
      })
    })

    it("builds active config payloads for 4K output", () => {
      expect(buildNdiConfigPayload(true, "fps60", "r4k")).toEqual({
        active: true,
        fps: 60,
        width: 3840,
        height: 2160,
      })
    })
  })

  describe("buildNdiStartRequest", () => {
    it("builds a start request from NDI settings", () => {
      expect(
        buildNdiStartRequest("Stage Feed", "r1080p", "fps24", "straightAlpha"),
      ).toEqual({
        sourceName: "Stage Feed",
        resolution: "r1080p",
        frameRate: "fps24",
        alphaMode: "straightAlpha",
      })
    })
  })

  describe("getDefaultOutputSettings", () => {
    it("defaults main output to external display", () => {
      expect(getDefaultOutputSettings("main")).toEqual({
        outputType: "display",
        ndiSourceName: DEFAULT_NDI_SOURCE_NAME,
        ndiResolution: "r1080p",
        ndiFrameRate: "fps24",
        ndiAlphaMode: "straightAlpha",
      })
    })

    it("defaults alternate output to external display", () => {
      expect(getDefaultOutputSettings("alt")).toEqual({
        outputType: "display",
        ndiSourceName: DEFAULT_NDI_ALT_SOURCE_NAME,
        ndiResolution: "r1080p",
        ndiFrameRate: "fps24",
        ndiAlphaMode: "straightAlpha",
      })
    })
  })
})
