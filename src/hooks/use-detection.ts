import { invokeTauri, isTauriRuntime } from "@/lib/tauri-runtime"
import { useBroadcastOutputIssueStore as useBroadcastStore } from "@/stores/broadcast/output-issue-store"
import { useDetectionStore } from "@/stores/detection-store"
import type { DetectionResult } from "@/types"

export interface DetectionControlStatus {
  detection_paused: boolean
  explicit_citations_only: boolean
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
    useBroadcastStore.getState().reportOutputIssue({
      outputId: "global",
      kind: "manual-detection",
      title: "Detection failed",
      description: `Manual verse detection failed: ${String(error)}`,
    })
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

async function setExplicitCitationsOnly(enabled: boolean) {
  if (!isTauriRuntime()) return enabled

  return invokeTauri<boolean>("set_explicit_citations_only", { enabled })
}

async function getDetectionControlStatus() {
  if (!isTauriRuntime()) {
    return { detection_paused: false, explicit_citations_only: false }
  }

  return invokeTauri<DetectionControlStatus>("detection_control_status")
}

export const detectionActions = {
  detectVerses,
  getDetectionStatus,
  setDetectionPaused,
  setExplicitCitationsOnly,
  getDetectionControlStatus,
  clearDetections: () => useDetectionStore.getState().clearDetections(),
  removeDetection: (verseRef: string) =>
    useDetectionStore.getState().removeDetection(verseRef),
}

export function useDetection() {
  const detections = useDetectionStore((s) => s.detections)

  return {
    detections,
    ...detectionActions,
  }
}
