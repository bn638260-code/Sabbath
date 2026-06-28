import { invokeTauri } from "@/lib/tauri-runtime"
import { useApiKeySettings } from "@/hooks/use-api-key-settings"
import {
  restartActiveTranscriptionIfNeeded,
  type ProviderChangeHandler,
} from "@/hooks/use-deepgram-key-settings"
import { useSettingsStore } from "@/stores/settings-store"

export async function saveSonioxApiKey(
  apiKey: string
): Promise<{ hasKey: boolean; error?: string }> {
  try {
    await invokeTauri("set_soniox_api_key", { apiKey })
    const hasKey = await invokeTauri<boolean>("has_soniox_api_key")
    if (!hasKey) {
      return { hasKey: false, error: "Soniox API key was not saved" }
    }
    return { hasKey: true }
  } catch (e) {
    return { hasKey: false, error: String(e) }
  }
}

export async function clearSonioxApiKey(): Promise<{ error?: string }> {
  try {
    await invokeTauri("clear_soniox_api_key")
    return {}
  } catch (e) {
    return { error: String(e) }
  }
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
