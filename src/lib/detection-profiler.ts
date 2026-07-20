interface DetectionProfilerStats {
  eventName: string
  count: number
  lastAt: number
  totalItems: number
  totalDurationMs: number
  maxDurationMs: number
}

interface DetectionStabilityStats {
  batches: number
  topCandidateSwitches: number
  autoSelections: number
  totalSelectionLatencyMs: number
  maxSelectionLatencyMs: number
}

interface DetectionCandidate {
  verse_ref: string
  confidence: number
  rank_score?: number
}

const statsByEvent = new Map<string, DetectionProfilerStats>()
const LOG_INTERVAL_MS = 5000
const STABILITY_WINDOW_MS = 8_000
const firstSeenAt = new Map<string, number>()
let lastTopCandidate: { key: string; seenAt: number } | null = null
const stabilityStats: DetectionStabilityStats = {
  batches: 0,
  topCandidateSwitches: 0,
  autoSelections: 0,
  totalSelectionLatencyMs: 0,
  maxSelectionLatencyMs: 0,
}

function candidateKey(candidate: DetectionCandidate): string {
  return candidate.verse_ref
}

export function observeDetectionCandidates(
  candidates: DetectionCandidate[],
  now = performance.now()
): void {
  stabilityStats.batches += 1
  const top = candidates.reduce<DetectionCandidate | null>((best, candidate) => {
    if (!best) return candidate
    return (candidate.rank_score ?? candidate.confidence) >
      (best.rank_score ?? best.confidence)
      ? candidate
      : best
  }, null)
  if (!top) return

  const key = candidateKey(top)
  if (!firstSeenAt.has(key)) firstSeenAt.set(key, now)
  if (
    lastTopCandidate &&
    now - lastTopCandidate.seenAt <= STABILITY_WINDOW_MS &&
    lastTopCandidate.key !== key
  ) {
    stabilityStats.topCandidateSwitches += 1
  }
  lastTopCandidate = { key, seenAt: now }
}

export function recordAutoSelectionPerformance(
  candidate: DetectionCandidate,
  now = performance.now()
): void {
  const firstSeen = firstSeenAt.get(candidateKey(candidate)) ?? now
  const latency = Math.max(0, now - firstSeen)
  stabilityStats.autoSelections += 1
  stabilityStats.totalSelectionLatencyMs += latency
  stabilityStats.maxSelectionLatencyMs = Math.max(
    stabilityStats.maxSelectionLatencyMs,
    latency
  )
}

export function getDetectionPerformanceSnapshot() {
  return {
    ...stabilityStats,
    averageSelectionLatencyMs:
      stabilityStats.autoSelections === 0
        ? 0
        : stabilityStats.totalSelectionLatencyMs / stabilityStats.autoSelections,
  }
}

export function resetDetectionPerformanceForTests(): void {
  statsByEvent.clear()
  firstSeenAt.clear()
  lastTopCandidate = null
  Object.assign(stabilityStats, {
    batches: 0,
    topCandidateSwitches: 0,
    autoSelections: 0,
    totalSelectionLatencyMs: 0,
    maxSelectionLatencyMs: 0,
  })
}

export function profileDetectionEvent<T>(
  eventName: "verse_detections" | "reading_mode_verse",
  itemCount: number,
  run: () => T,
): T {
  const startedAt = performance.now()
  const finish = () => {
    const duration = performance.now() - startedAt
    const now = Date.now()
    const current =
      statsByEvent.get(eventName) ??
      {
        eventName,
        count: 0,
        lastAt: 0,
        totalItems: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
      }

    current.count += 1
    current.totalItems += itemCount
    current.totalDurationMs += duration
    current.maxDurationMs = Math.max(current.maxDurationMs, duration)

    if (now - current.lastAt >= LOG_INTERVAL_MS) {
      current.lastAt = now
      console.info("[detection-profiler]", {
        eventName: current.eventName,
        events: current.count,
        avgItems: Number((current.totalItems / current.count).toFixed(2)),
        avgDurationMs: Number((current.totalDurationMs / current.count).toFixed(2)),
        maxDurationMs: Number(current.maxDurationMs.toFixed(2)),
        ...getDetectionPerformanceSnapshot(),
      })
    }

    statsByEvent.set(eventName, current)
  }

  try {
    const result = run()
    if (result instanceof Promise) {
      return result.finally(finish) as T
    }
    finish()
    return result
  } catch (error) {
    finish()
    throw error
  }
}
