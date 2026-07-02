import { useApiKeySettings } from "@/hooks/use-api-key-settings"
import {
  createProviderKeyActions,
  restartActiveTranscriptionIfNeeded,
  type ProviderChangeHandler,
} from "@/lib/stt-key-settings"
import { useSettingsStore } from "@/stores/settings-store"

const gladiaKeyActions = createProviderKeyActions({
  label: "Gladia",
  setCommand: "set_gladia_api_key",
  hasCommand: "has_gladia_api_key",
  clearCommand: "clear_gladia_api_key",
})

export async function saveGladiaApiKey(
  apiKey: string
): Promise<{ hasKey: boolean; error?: string }> {
  return gladiaKeyActions.saveApiKey(apiKey)
}

export async function clearGladiaApiKey(): Promise<{ error?: string }> {
  return gladiaKeyActions.clearApiKey()
}

export function useGladiaKeySettings(
  handleProviderChange: ProviderChangeHandler
) {
  const { hasGladiaApiKey, setHasGladiaApiKey } = useSettingsStore()

  const keySettings = useApiKeySettings({
    hasKey: hasGladiaApiKey,
    setHasKey: setHasGladiaApiKey,
    save: saveGladiaApiKey,
    clear: clearGladiaApiKey,
    onSaved: restartActiveTranscriptionIfNeeded,
  })

  return {
    hasGladiaApiKey,
    ...keySettings,
    handleProviderChange,
  }
}
