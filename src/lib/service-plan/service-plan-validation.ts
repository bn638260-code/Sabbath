import type {
  HymnRef,
  MediaRef,
  ScriptureRef,
  ServiceAttachment,
  ServiceChecklistItem,
  ServiceItem,
  ServicePlan,
} from "@/types/service-plan"

const PLAN_STATUSES = new Set(["draft", "practice", "live", "completed", "archived"])
const SERVICE_MODES = new Set(["planning", "practice", "performance"])
const ITEM_KINDS = new Set(["general", "scripture", "hymn", "media", "slide", "announcement"])
const ITEM_STATUSES = new Set(["pending", "ready", "active", "completed", "skipped"])
const ATTACHMENT_KINDS = new Set(["media", "slide", "document"])
const ATTACHMENT_STATUSES = new Set(["pending", "ready", "failed", "preloading"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string"
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value))
}

export function isValidServicePlan(plan: ServicePlan): boolean {
  if (!isRecord(plan)) return false
  if (typeof plan.id !== "string" || !plan.id) return false
  if (typeof plan.title !== "string" || !plan.title.trim()) return false
  if (!PLAN_STATUSES.has(String(plan.status))) return false
  if (!SERVICE_MODES.has(String(plan.mode))) return false
  if (!isOptionalString(plan.templateId)) return false
  if (!isOptionalString(plan.scheduledAt)) return false
  if (typeof plan.createdAt !== "number" || !Number.isFinite(plan.createdAt)) return false
  if (typeof plan.updatedAt !== "number" || !Number.isFinite(plan.updatedAt)) return false
  if (plan.activeItemId !== null && typeof plan.activeItemId !== "string") return false
  if (!Array.isArray(plan.items)) return false
  if (!Array.isArray(plan.eventLog)) return false
  return plan.items.every(isValidServiceItem)
}

export function isValidServiceItem(item: ServiceItem): boolean {
  if (!isRecord(item)) return false
  if (typeof item.id !== "string" || !item.id) return false
  if (typeof item.title !== "string" || !item.title.trim()) return false
  if (typeof item.order !== "number" || !Number.isFinite(item.order)) return false
  if (!ITEM_KINDS.has(String(item.kind))) return false
  if (!ITEM_STATUSES.has(String(item.status))) return false
  if (!isOptionalNumber(item.durationMinutes)) return false
  if (!isOptionalString(item.notes)) return false
  if (!isOptionalString(item.outputTemplateId)) return false
  return (
    Array.isArray(item.scriptureRefs) &&
    item.scriptureRefs.every(isValidScriptureRef) &&
    Array.isArray(item.hymnRefs) &&
    item.hymnRefs.every(isValidHymnRef) &&
    Array.isArray(item.mediaRefs) &&
    item.mediaRefs.every(isValidMediaRef) &&
    Array.isArray(item.attachments) &&
    item.attachments.every(isValidAttachment) &&
    Array.isArray(item.checklist) &&
    item.checklist.every(isValidChecklistItem)
  )
}

export function isValidScriptureRef(ref: ScriptureRef): boolean {
  if (!isRecord(ref)) return false
  return (
    isOptionalString(ref.book) &&
    isOptionalNumber(ref.chapter) &&
    isOptionalNumber(ref.verse) &&
    isOptionalString(ref.reference)
  )
}

export function isValidHymnRef(ref: HymnRef): boolean {
  if (!isRecord(ref)) return false
  return (
    isOptionalString(ref.hymnId) &&
    isOptionalNumber(ref.hymnNumber) &&
    isOptionalString(ref.title)
  )
}

export function isValidMediaRef(ref: MediaRef): boolean {
  if (!isRecord(ref)) return false
  return (
    typeof ref.attachmentId === "string" &&
    typeof ref.label === "string" &&
    isOptionalString(ref.path)
  )
}

export function isValidAttachment(attachment: ServiceAttachment): boolean {
  if (!isRecord(attachment)) return false
  return (
    typeof attachment.id === "string" &&
    ATTACHMENT_KINDS.has(String(attachment.kind)) &&
    typeof attachment.label === "string" &&
    isOptionalString(attachment.path) &&
    ATTACHMENT_STATUSES.has(String(attachment.status)) &&
    isOptionalString(attachment.thumbnailUrl) &&
    isOptionalString(attachment.mimeType) &&
    isOptionalNumber(attachment.sizeBytes)
  )
}

export function isValidChecklistItem(item: ServiceChecklistItem): boolean {
  if (!isRecord(item)) return false
  return typeof item.id === "string" && typeof item.label === "string" && typeof item.done === "boolean"
}

export function normalizeItemOrder(items: ServiceItem[]): ServiceItem[] {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({ ...item, order: index }))
}

export function findNextServiceItem(
  items: ServiceItem[],
  activeItemId: string | null,
): ServiceItem | null {
  const ordered = normalizeItemOrder(items)
  if (ordered.length === 0) return null

  if (!activeItemId) {
    return ordered.find((item) => item.status !== "completed" && item.status !== "skipped") ?? null
  }

  const activeIndex = ordered.findIndex((item) => item.id === activeItemId)
  if (activeIndex === -1) {
    return ordered.find((item) => item.status !== "completed" && item.status !== "skipped") ?? null
  }

  for (let index = activeIndex + 1; index < ordered.length; index += 1) {
    const candidate = ordered[index]
    if (candidate.status !== "completed" && candidate.status !== "skipped") {
      return candidate
    }
  }

  return null
}
