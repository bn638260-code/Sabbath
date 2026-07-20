import { describe, expect, it, vi } from "vitest"
import {
  ADMIN_TUTORIAL_STEPS,
  TUTORIAL_STEPS,
  tutorialCompletionError,
  tutorialStepsFor,
  type TutorialStep,
} from "./tutorial-steps"

describe("role-aware tutorial steps", () => {
  it("keeps operator and admin restarts separate and combines first-run admin training", () => {
    expect(tutorialStepsFor("operator")).toEqual(TUTORIAL_STEPS)
    expect(tutorialStepsFor("admin")).toEqual(ADMIN_TUTORIAL_STEPS)
    expect(tutorialStepsFor("all")).toHaveLength(
      TUTORIAL_STEPS.length + ADMIN_TUTORIAL_STEPS.length
    )
  })

  it("blocks advancement until an observable exercise is complete", () => {
    const check = vi.fn(() => false)
    const step = {
      target: "body",
      content: "Practice",
      completion: { check, message: "Complete the task." },
    } satisfies TutorialStep

    expect(tutorialCompletionError(step, false)).toBe("Complete the task.")
    check.mockReturnValue(true)
    expect(tutorialCompletionError(step, false)).toBeNull()
  })

  it("requires explicit confirmation for hardware practice", () => {
    const step = {
      target: "body",
      content: "Projector rehearsal",
      completion: {
        confirmationLabel: "I practised this.",
        message: "Confirm practice.",
      },
    } satisfies TutorialStep

    expect(tutorialCompletionError(step, false)).toBe("Confirm practice.")
    expect(tutorialCompletionError(step, true)).toBeNull()
  })
})
