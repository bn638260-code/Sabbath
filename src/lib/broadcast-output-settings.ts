import {
  DEFAULT_NDI_ALT_SOURCE_NAME,
  DEFAULT_NDI_SOURCE_NAME,
} from "@/lib/app-brand"
import type { BroadcastOutputId } from "@/components/broadcast/broadcast-settings-wiring"
import type {
  NdiAlphaMode,
  NdiConfigEventPayload,
  NdiFrameRate,
  NdiResolution,
  NdiStartRequest,
} from "@/types"

export type BroadcastOutputType = "display" | "ndi"

export const NDI_RESOLUTION_OPTIONS: Array<{ value: NdiResolution; label: string }> = [
  { value: "r1080p", label: "1080p (1920×1080)" },
  { value: "r720p", label: "720p (1280×720)" },
  { value: "r4k", label: "4K (3840×2160)" },
]

export const NDI_FRAME_RATE_OPTIONS: Array<{ value: NdiFrameRate; label: string }> = [
  { value: "fps24", label: "24 fps" },
  { value: "fps30", label: "30 fps" },
  { value: "fps60", label: "60 fps" },
]

export const NDI_ALPHA_OPTIONS: Array<{ value: NdiAlphaMode; label: string }> = [
  { value: "noneOpaque", label: "None (Opaque)" },
  { value: "straightAlpha", label: "Straight Alpha" },
  { value: "premultipliedAlpha", label: "Premultiplied Alpha" },
]

export interface NdiDimensions {
  width: number
  height: number
}

export interface BroadcastOutputDefaults {
  outputType: BroadcastOutputType
  ndiSourceName: string
  ndiResolution: NdiResolution
  ndiFrameRate: NdiFrameRate
  ndiAlphaMode: NdiAlphaMode
}

export function ndiFrameRateToNumber(frameRate: NdiFrameRate): number {
  switch (frameRate) {
    case "fps24":
      return 24
    case "fps30":
      return 30
    case "fps60":
      return 60
  }
}

export function getBroadcastWindowLabel(outputId: BroadcastOutputId): string {
  return outputId === "alt" ? "broadcast-alt" : "broadcast"
}

export function resolveNdiDimensions(resolution: NdiResolution): NdiDimensions {
  switch (resolution) {
    case "r720p":
      return { width: 1280, height: 720 }
    case "r4k":
      return { width: 3840, height: 2160 }
    case "r1080p":
      return { width: 1920, height: 1080 }
  }
}

export function buildNdiConfigPayload(
  active: boolean,
  frameRate: NdiFrameRate,
  resolution: NdiResolution,
): NdiConfigEventPayload {
  const dims = resolveNdiDimensions(resolution)
  return {
    active,
    fps: ndiFrameRateToNumber(frameRate),
    width: dims.width,
    height: dims.height,
  }
}

export function buildNdiStartRequest(
  sourceName: string,
  resolution: NdiResolution,
  frameRate: NdiFrameRate,
  alphaMode: NdiAlphaMode,
): NdiStartRequest {
  return {
    sourceName,
    resolution,
    frameRate,
    alphaMode,
  }
}

export function getDefaultOutputSettings(outputId: BroadcastOutputId): BroadcastOutputDefaults {
  if (outputId === "alt") {
    return {
      outputType: "ndi",
      ndiSourceName: DEFAULT_NDI_ALT_SOURCE_NAME,
      ndiResolution: "r1080p",
      ndiFrameRate: "fps24",
      ndiAlphaMode: "straightAlpha",
    }
  }

  return {
    outputType: "display",
    ndiSourceName: DEFAULT_NDI_SOURCE_NAME,
    ndiResolution: "r1080p",
    ndiFrameRate: "fps24",
    ndiAlphaMode: "straightAlpha",
  }
}
