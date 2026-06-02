import { describe, expect, it } from "vitest"
import {
  completeServicePlan,
  duplicateServiceItem,
} from "./service-plan-actions"
import type { ServicePlan } from "@/types/service-plan"

function plan(): ServicePlan {
  return {
    id: "plan-1",
    title: "Morning Worship",
    status: "live",
    mode: "performance",
    createdAt: 1,
    updatedAt: 1,
    activeItemId: "item-1",
    eventLog: [],
    items: [
      {
        id: "item-1",
        order: 0,
        title: "Sermon",
        kind: "slide",
        status: "active",
        scriptureRefs: [{ reference: "John 3:16" }],
        hymnRefs: [{ hymnNumber: 1 }],
        mediaRefs: [{ attachmentId: "slide-1", label: "Opening" }],
        attachments: [
          {
            id: "slide-1",
            kind: "slide",
            label: "Opening",
            status: "ready",
            thumbnailUrl: "data:image/png;base64,one",
          },
        ],
        checklist: [{ id: "check-1", label: "Mic ready", done: true }],
      },
    ],
  }
}

describe("service plan actions", () => {
  it("duplicates nested item resources with fresh identifiers", () => {
    const duplicate = duplicateServiceItem(plan(), "item-1").items[1]

    expect(duplicate.id).not.toBe("item-1")
    expect(duplicate.attachments[0].id).not.toBe("slide-1")
    expect(duplicate.mediaRefs[0].attachmentId).toBe(
      duplicate.attachments[0].id
    )
    expect(duplicate.checklist[0].id).not.toBe("check-1")
    expect(duplicate.status).toBe("pending")
  })

  it("completes the active item when the full service is completed", () => {
    const completed = completeServicePlan(plan())

    expect(completed).toMatchObject({
      status: "completed",
      mode: "planning",
      activeItemId: null,
    })
    expect(completed.items[0].status).toBe("completed")
  })
})
