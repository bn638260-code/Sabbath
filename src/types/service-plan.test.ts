import { describe, expect, it } from "vitest"
import {
  createPlanFromTemplate,
  isLightweightTemplate,
  SERVICE_PLAN_TEMPLATES,
} from "@/lib/service-plan/service-plan-templates"
import { isValidServicePlan } from "@/lib/service-plan/service-plan-validation"

describe("service plan types and templates", () => {
  it("includes all required default templates", () => {
    const ids = SERVICE_PLAN_TEMPLATES.map((template) => template.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        "standard-sabbath",
        "communion",
        "youth-sabbath",
        "evangelistic",
        "health",
        "prayer-meeting",
        "blank",
      ]),
    )
  })

  it("creates lightweight metadata-only plans from templates", () => {
    for (const template of SERVICE_PLAN_TEMPLATES) {
      expect(isLightweightTemplate(template.id)).toBe(true)
      const plan = createPlanFromTemplate(template.id)
      expect(plan).not.toBeNull()
      expect(isValidServicePlan(plan!)).toBe(true)
      expect(plan!.items.every((item) => item.attachments.length === 0)).toBe(true)
    }
  })

  it("creates a standard Sabbath plan with ordered items", () => {
    const plan = createPlanFromTemplate("standard-sabbath", "Morning Worship")
    expect(plan).toMatchObject({
      title: "Morning Worship",
      templateId: "standard-sabbath",
      status: "draft",
      mode: "planning",
    })
    expect(plan!.items.length).toBeGreaterThan(3)
  })
})
