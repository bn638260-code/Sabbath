import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { invokeTauri } from "@/lib/tauri-runtime"

export interface AssetStatus {
  bible_db: boolean
  whisper_model: boolean
  whisper_model_name?: string | null
  vosk_model: boolean
  vosk_model_name?: string | null
  vosk_model_quality?: string | null
  vosk_worker: boolean
  vosk_runtime: boolean
  vosk_runtime_error: string | null
  onnx_model: boolean
  tokenizer: boolean
  embeddings: boolean
  embedding_ids: boolean
  semantic_ready: boolean
  ndi_sdk: boolean
}

export function useAssets() {
  const [status, setStatus] = useState<AssetStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await invokeTauri<AssetStatus>("asset_status"))
    } catch (error) {
      setStatus(null)
      toast.error("Could not check asset status", {
        id: "asset-status-error",
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void refresh()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [refresh])

  return { status, loading, refresh }
}
