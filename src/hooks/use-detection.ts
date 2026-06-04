import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"
import { useDetectionStore } from "@/stores/detection-store"
import type { DetectionResult } from "@/types"

export interface DetectionControlStatus {
  detection_paused: boolean
}

// Stable action functions (same pattern as use-bible.ts)
async function detectVerses(text: string) {
  if (!isTauriRuntime()) return []

  try {
    const results = await invokeTauri<DetectionResult[]>("detect_verses", { text })
    if (results.length > 0) {
      useDetectionStore.getState().addDetections(results)
    }
    return results
  } catch (error) {
    console.warn("[detection] detect_verses failed", error)
    return []
  }
}

async function getDetectionStatus() {
  if (!isTauriRuntime()) {
    return {
      has_direct: false,
      has_semantic: false,
      paraphrase_enabled: false,
    }
  }

  return invokeTauri<{
    has_direct: boolean
    has_semantic: boolean
    paraphrase_enabled: boolean
  }>(
    "detection_status"
  )
}

async function setDetectionPaused(paused: boolean) {
  if (!isTauriRuntime()) return paused

  return invokeTauri<boolean>("set_detection_paused", { paused })
}

async function getDetectionControlStatus() {
  if (!isTauriRuntime()) {
    return { detection_paused: false }
  }

  return invokeTauri<DetectionControlStatus>("detection_control_status")
}

export const detectionActions = {
  detectVerses,
  getDetectionStatus,
  setDetectionPaused,
  getDetectionControlStatus,
  clearDetections: () => useDetectionStore.getState().clearDetections(),
  removeDetection: (verseRef: string) =>
    useDetectionStore.getState().removeDetection(verseRef),
}

export function useDetection() {
  const detections = useDetectionStore((s) => s.detections)
  const autoMode = useDetectionStore((s) => s.autoMode)
  const confidenceThreshold = useDetectionStore((s) => s.confidenceThreshold)

  return {
    detections,
    autoMode,
    confidenceThreshold,
    ...detectionActions,
  }
}
