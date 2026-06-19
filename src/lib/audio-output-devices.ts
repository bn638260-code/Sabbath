export interface AudioOutputDevice {
  deviceId: string
  label: string
}

export async function listAudioOutputDevices(): Promise<AudioOutputDevice[]> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return []
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter((device) => device.kind === "audiooutput")
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Audio output ${index + 1}`,
      }))
  } catch {
    return []
  }
}

export function canSetAudioSink(): boolean {
  if (typeof document === "undefined") return false
  return "setSinkId" in document.createElement("video")
}

export function audioOutputScanLabel(input: {
  canRouteAudio: boolean
  loading: boolean
  devices: AudioOutputDevice[]
}): string {
  if (!input.canRouteAudio) return "Routing unavailable"
  if (input.loading) return "Scanning outputs"
  if (input.devices.length === 0) return "No outputs found"
  if (input.devices.length === 1) return "1 output found"
  return `${input.devices.length} outputs found`
}
