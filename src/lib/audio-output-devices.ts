export interface AudioOutputDevice {
  deviceId: string
  label: string
}

async function rawAudioOutputs(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((device) => device.kind === "audiooutput")
}

export async function listAudioOutputDevices(): Promise<AudioOutputDevice[]> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return []
  }
  try {
    let outputs = await rawAudioOutputs()
    // WebViews hide output devices (empty list or blank labels) until the page
    // has been granted media permission. Unlock once via getUserMedia, stop the
    // tracks, then re-enumerate so the real device names appear.
    const needsUnlock =
      outputs.length === 0 || outputs.some((device) => !device.label)
    if (needsUnlock && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
        outputs = await rawAudioOutputs()
      } catch {
        // No input device or permission denied: fall back to what enumerated.
      }
    }
    return outputs.map((device, index) => ({
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
