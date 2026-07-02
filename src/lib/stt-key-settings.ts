import { invokeTauri } from "@/lib/tauri-runtime"
import { transcriptionActions } from "@/hooks/use-transcription"
import { useTranscriptStore } from "@/stores/transcript-store"
import type { SttProvider } from "@/stores/settings-store"

const STT_RESTART_DELAY_MS = 350

export type ProviderChangeHandler = (provider: SttProvider) => void

interface ProviderKeyCommandConfig {
  label: string
  setCommand: string
  hasCommand: string
  clearCommand: string
}

export function createProviderKeyActions({
  label,
  setCommand,
  hasCommand,
  clearCommand,
}: ProviderKeyCommandConfig) {
  return {
    async saveApiKey(apiKey: string): Promise<{ hasKey: boolean; error?: string }> {
      try {
        await invokeTauri(setCommand, { apiKey })
        const hasKey = await invokeTauri<boolean>(hasCommand)
        if (!hasKey) {
          return { hasKey: false, error: `${label} API key was not saved` }
        }
        return { hasKey: true }
      } catch (e) {
        return { hasKey: false, error: String(e) }
      }
    },

    async clearApiKey(): Promise<{ error?: string }> {
      try {
        await invokeTauri(clearCommand)
        return {}
      } catch (e) {
        return { error: String(e) }
      }
    },
  }
}

export async function restartActiveTranscriptionIfNeeded(): Promise<void> {
  if (!useTranscriptStore.getState().isTranscribing) return

  await transcriptionActions.stop()
  await new Promise((resolve) => setTimeout(resolve, STT_RESTART_DELAY_MS))
  await transcriptionActions.start()
}
