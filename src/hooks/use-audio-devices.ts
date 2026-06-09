import { useCallback, useEffect, useState } from "react"
import { invokeTauri } from "@/lib/tauri-runtime"
import type { DeviceInfo } from "@/types/audio"

export async function fetchAudioDevices(): Promise<DeviceInfo[]> {
  try {
    return await invokeTauri<DeviceInfo[]>("get_audio_devices")
  } catch {
    return []
  }
}

export function useAudioDevices() {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true)
      const result = await fetchAudioDevices()
      setDevices(result)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadDevices()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [loadDevices])

  return { devices, loading, loadDevices }
}
