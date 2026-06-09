import { useCallback, useState } from "react"
import { invokeTauri } from "@/lib/tauri-runtime"
import { transcriptionActions } from "@/hooks/use-transcription"
import { useSettingsStore } from "@/stores/settings-store"
import { useTranscriptStore } from "@/stores/transcript-store"

const SAVED_KEY_DISPLAY = "Saved in secure keychain"
const STT_RESTART_DELAY_MS = 350

export async function saveDeepgramApiKey(
  apiKey: string,
): Promise<{ hasKey: boolean; error?: string }> {
  try {
    await invokeTauri("set_deepgram_api_key", { apiKey })
    const hasKey = await invokeTauri<boolean>("has_deepgram_api_key")
    if (!hasKey) {
      return { hasKey: false, error: "Deepgram API key was not saved" }
    }
    return { hasKey: true }
  } catch (e) {
    return { hasKey: false, error: String(e) }
  }
}

export async function clearDeepgramApiKey(): Promise<{ error?: string }> {
  try {
    await invokeTauri("clear_deepgram_api_key")
    return {}
  } catch (e) {
    return { error: String(e) }
  }
}

export async function restartActiveTranscriptionIfNeeded(): Promise<void> {
  if (!useTranscriptStore.getState().isTranscribing) return

  await transcriptionActions.stop()
  await new Promise((resolve) => setTimeout(resolve, STT_RESTART_DELAY_MS))
  await transcriptionActions.start()
}

export function useDeepgramKeySettings() {
  const {
    sttProvider,
    setSttProvider,
    hasDeepgramApiKey,
    setHasDeepgramApiKey,
  } = useSettingsStore()

  const [keyValue, setKeyValue] = useState("")
  const [editingSavedKey, setEditingSavedKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [switchingStt, setSwitchingStt] = useState(false)

  const displayedKeyValue =
    hasDeepgramApiKey && !editingSavedKey && !keyValue
      ? SAVED_KEY_DISPLAY
      : keyValue
  const keyActionLabel = hasDeepgramApiKey ? "Update" : "Save"

  const handleSaveKey = useCallback(async () => {
    setKeyError(null)
    const result = await saveDeepgramApiKey(keyValue)
    setHasDeepgramApiKey(result.hasKey)
    if (result.error) {
      setKeyError(result.error)
      return
    }
    if (result.hasKey) {
      setKeyValue("")
      setEditingSavedKey(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }, [keyValue, setHasDeepgramApiKey])

  const handleKeyAction = useCallback(async () => {
    if (hasDeepgramApiKey && !editingSavedKey && !keyValue) {
      setEditingSavedKey(true)
      return
    }
    await handleSaveKey()
  }, [editingSavedKey, handleSaveKey, hasDeepgramApiKey, keyValue])

  const handleClearKey = useCallback(async () => {
    setKeyError(null)
    const result = await clearDeepgramApiKey()
    if (result.error) {
      setKeyError(result.error)
      return
    }
    setHasDeepgramApiKey(false)
    setKeyValue("")
    setEditingSavedKey(false)
  }, [setHasDeepgramApiKey])

  const restartActiveTranscription = useCallback(async () => {
    setSwitchingStt(true)
    try {
      await restartActiveTranscriptionIfNeeded()
    } finally {
      setSwitchingStt(false)
    }
  }, [])

  const handleProviderChange = useCallback(
    (provider: "deepgram" | "vosk") => {
      if (provider === sttProvider || switchingStt) return
      setSttProvider(provider)
      void restartActiveTranscription()
    },
    [restartActiveTranscription, setSttProvider, sttProvider, switchingStt],
  )

  return {
    sttProvider,
    hasDeepgramApiKey,
    keyValue,
    setKeyValue,
    editingSavedKey,
    setEditingSavedKey,
    saved,
    keyError,
    switchingStt,
    displayedKeyValue,
    keyActionLabel,
    handleKeyAction,
    handleClearKey,
    handleProviderChange,
  }
}
