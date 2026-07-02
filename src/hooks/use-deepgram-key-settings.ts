import { useCallback, useState } from "react"
import { useApiKeySettings } from "@/hooks/use-api-key-settings"
import {
  createProviderKeyActions,
  restartActiveTranscriptionIfNeeded,
} from "@/lib/stt-key-settings"
import { useSettingsStore, type SttProvider } from "@/stores/settings-store"

const deepgramKeyActions = createProviderKeyActions({
  label: "Deepgram",
  setCommand: "set_deepgram_api_key",
  hasCommand: "has_deepgram_api_key",
  clearCommand: "clear_deepgram_api_key",
})

export async function saveDeepgramApiKey(
  apiKey: string
): Promise<{ hasKey: boolean; error?: string }> {
  return deepgramKeyActions.saveApiKey(apiKey)
}

export async function clearDeepgramApiKey(): Promise<{ error?: string }> {
  return deepgramKeyActions.clearApiKey()
}

export function useDeepgramKeySettings() {
  const {
    sttProvider,
    setSttProvider,
    hasDeepgramApiKey,
    setHasDeepgramApiKey,
  } = useSettingsStore()

  const [switchingStt, setSwitchingStt] = useState(false)

  const keySettings = useApiKeySettings({
    hasKey: hasDeepgramApiKey,
    setHasKey: setHasDeepgramApiKey,
    save: saveDeepgramApiKey,
    clear: clearDeepgramApiKey,
  })

  const restartActiveTranscription = useCallback(async () => {
    setSwitchingStt(true)
    try {
      await restartActiveTranscriptionIfNeeded()
    } finally {
      setSwitchingStt(false)
    }
  }, [])

  const handleProviderChange = useCallback(
    (provider: SttProvider) => {
      if (provider === sttProvider || switchingStt) return
      setSttProvider(provider)
      void restartActiveTranscription()
    },
    [restartActiveTranscription, setSttProvider, sttProvider, switchingStt]
  )

  return {
    sttProvider,
    hasDeepgramApiKey,
    ...keySettings,
    switchingStt,
    handleProviderChange,
  }
}
