import { useApiKeySettings } from "@/hooks/use-api-key-settings"
import {
  createProviderKeyActions,
  restartActiveTranscriptionIfNeeded,
  type ProviderChangeHandler,
} from "@/lib/stt-key-settings"
import { useSettingsStore } from "@/stores/settings-store"

const sonioxKeyActions = createProviderKeyActions({
  label: "Soniox",
  setCommand: "set_soniox_api_key",
  hasCommand: "has_soniox_api_key",
  clearCommand: "clear_soniox_api_key",
})

export async function saveSonioxApiKey(
  apiKey: string
): Promise<{ hasKey: boolean; error?: string }> {
  return sonioxKeyActions.saveApiKey(apiKey)
}

export async function clearSonioxApiKey(): Promise<{ error?: string }> {
  return sonioxKeyActions.clearApiKey()
}

export function useSonioxKeySettings(
  handleProviderChange: ProviderChangeHandler
) {
  const { hasSonioxApiKey, setHasSonioxApiKey } = useSettingsStore()

  const keySettings = useApiKeySettings({
    hasKey: hasSonioxApiKey,
    setHasKey: setHasSonioxApiKey,
    save: saveSonioxApiKey,
    clear: clearSonioxApiKey,
    onSaved: restartActiveTranscriptionIfNeeded,
  })

  return {
    hasSonioxApiKey,
    ...keySettings,
    handleProviderChange,
  }
}
