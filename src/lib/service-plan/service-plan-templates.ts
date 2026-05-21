import type { ServiceItem, ServicePlan } from "@/types/service-plan"

export interface ServicePlanTemplate {
  id: string
  label: string
  description: string
  items: Array<Pick<ServiceItem, "title" | "kind" | "durationMinutes">>
}

function createItem(
  order: number,
  title: string,
  kind: ServiceItem["kind"],
  durationMinutes?: number,
): ServiceItem {
  return {
    id: crypto.randomUUID(),
    order,
    title,
    kind,
    durationMinutes,
    status: "pending",
    scriptureRefs: [],
    hymnRefs: [],
    mediaRefs: [],
    attachments: [],
    checklist: [],
  }
}

export const SERVICE_PLAN_TEMPLATES: ServicePlanTemplate[] = [
  {
    id: "standard-sabbath",
    label: "Standard Sabbath",
    description: "Opening, worship, scripture, sermon, and closing.",
    items: [
      { title: "Prelude", kind: "media", durationMinutes: 5 },
      { title: "Opening Hymn", kind: "hymn", durationMinutes: 4 },
      { title: "Scripture Reading", kind: "scripture", durationMinutes: 5 },
      { title: "Special Music", kind: "media", durationMinutes: 5 },
      { title: "Sermon", kind: "general", durationMinutes: 35 },
      { title: "Closing Hymn", kind: "hymn", durationMinutes: 4 },
      { title: "Benediction", kind: "announcement", durationMinutes: 2 },
    ],
  },
  {
    id: "communion",
    label: "Communion",
    description: "Communion-focused Sabbath order.",
    items: [
      { title: "Opening Hymn", kind: "hymn", durationMinutes: 4 },
      { title: "Scripture Reading", kind: "scripture", durationMinutes: 5 },
      { title: "Communion Meditation", kind: "general", durationMinutes: 15 },
      { title: "Communion Hymn", kind: "hymn", durationMinutes: 4 },
      { title: "Closing", kind: "announcement", durationMinutes: 2 },
    ],
  },
  {
    id: "youth-sabbath",
    label: "Youth Sabbath",
    description: "Youth-led worship with shorter segments.",
    items: [
      { title: "Welcome", kind: "announcement", durationMinutes: 3 },
      { title: "Praise Song", kind: "hymn", durationMinutes: 5 },
      { title: "Youth Scripture", kind: "scripture", durationMinutes: 5 },
      { title: "Youth Message", kind: "general", durationMinutes: 20 },
      { title: "Closing Song", kind: "hymn", durationMinutes: 4 },
    ],
  },
  {
    id: "evangelistic",
    label: "Evangelistic Program",
    description: "Extended program with media and response.",
    items: [
      { title: "Pre-service Media", kind: "media", durationMinutes: 10 },
      { title: "Opening Song", kind: "hymn", durationMinutes: 5 },
      { title: "Main Presentation", kind: "slide", durationMinutes: 45 },
      { title: "Altar Call", kind: "announcement", durationMinutes: 10 },
      { title: "Closing", kind: "hymn", durationMinutes: 4 },
    ],
  },
  {
    id: "health",
    label: "Health Program",
    description: "Health-focused presentation blocks.",
    items: [
      { title: "Welcome", kind: "announcement", durationMinutes: 3 },
      { title: "Health Topic Intro", kind: "slide", durationMinutes: 10 },
      { title: "Demonstration", kind: "media", durationMinutes: 15 },
      { title: "Q&A", kind: "general", durationMinutes: 15 },
      { title: "Closing", kind: "announcement", durationMinutes: 3 },
    ],
  },
  {
    id: "prayer-meeting",
    label: "Prayer Meeting",
    description: "Short prayer-focused gathering.",
    items: [
      { title: "Opening Prayer", kind: "general", durationMinutes: 5 },
      { title: "Scripture", kind: "scripture", durationMinutes: 5 },
      { title: "Testimonies", kind: "general", durationMinutes: 20 },
      { title: "Closing Prayer", kind: "general", durationMinutes: 5 },
    ],
  },
  {
    id: "blank",
    label: "Blank Plan",
    description: "Empty plan to build from scratch.",
    items: [],
  },
]

export function createPlanFromTemplate(
  templateId: string,
  title?: string,
): ServicePlan | null {
  const template = SERVICE_PLAN_TEMPLATES.find((entry) => entry.id === templateId)
  if (!template) return null

  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title: title?.trim() || template.label,
    status: "draft",
    mode: "planning",
    templateId: template.id,
    createdAt: now,
    updatedAt: now,
    activeItemId: null,
    items: template.items.map((item, order) => createItem(order, item.title, item.kind, item.durationMinutes)),
    eventLog: [],
  }
}

export function isLightweightTemplate(templateId: string): boolean {
  const template = SERVICE_PLAN_TEMPLATES.find((entry) => entry.id === templateId)
  if (!template) return false
  return template.items.every(
    (item) => item.kind !== "media" || !("path" in item),
  )
}
