import type { ServiceContext } from "@/types/service-plan"

export type PreloadStatus = "idle" | "loading" | "ready" | "failed"

export type PreloadScope = "active" | "next" | "emergency"

interface PreloadedMedia {
  id: string
  path: string
  status: PreloadStatus
  scope: PreloadScope
  loadedAt: number | null
}

const preloaded = new Map<string, PreloadedMedia>()

function startPreload(entry: { id: string; path: string; scope: PreloadScope }): void {
  const existing = preloaded.get(entry.id)
  if (existing?.status === "ready") {
    preloaded.set(entry.id, { ...existing, scope: entry.scope })
    return
  }

  preloaded.set(entry.id, {
    id: entry.id,
    path: entry.path,
    status: "loading",
    scope: entry.scope,
    loadedAt: null,
  })

  queueMicrotask(() => {
    const current = preloaded.get(entry.id)
    if (!current || current.status !== "loading") return

    if (!entry.path || entry.path.includes("missing")) {
      preloaded.set(entry.id, {
        ...current,
        status: "failed",
        loadedAt: Date.now(),
      })
      return
    }

    preloaded.set(entry.id, {
      ...current,
      status: "ready",
      loadedAt: Date.now(),
    })
  })
}

export const mediaPreloadManager = {
  syncFromContext(context: ServiceContext, emergencyPaths: string[] = []): void {
    const keepIds = new Set<string>()

    for (const media of context.mediaSummaries) {
      keepIds.add(media.id)
      startPreload({ id: media.id, path: media.label, scope: media.scope })
    }

    for (const path of emergencyPaths) {
      if (!path) continue
      keepIds.add(path)
      startPreload({ id: path, path, scope: "emergency" })
    }

    for (const [id] of preloaded) {
      if (!keepIds.has(id)) {
        preloaded.delete(id)
      }
    }
  },

  releaseCompletedItem(id: string): void {
    const entry = preloaded.get(id)
    if (!entry || entry.scope === "active" || entry.scope === "emergency") return
    preloaded.delete(id)
  },

  releaseAll(): void {
    preloaded.clear()
  },

  getPreloadStatus(id: string): PreloadStatus {
    return preloaded.get(id)?.status ?? "idle"
  },

  getPreloadedIds(): string[] {
    return [...preloaded.keys()]
  },

  getActiveNextIds(context: ServiceContext): string[] {
    return context.mediaSummaries.map((media) => media.id)
  },

  markFailed(id: string): void {
    const entry = preloaded.get(id)
    if (!entry) return
    preloaded.set(id, { ...entry, status: "failed", loadedAt: Date.now() })
  },
}
