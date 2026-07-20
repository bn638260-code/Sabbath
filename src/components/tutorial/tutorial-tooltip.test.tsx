// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { TooltipRenderProps } from "react-joyride"
import { TutorialTooltip } from "./tutorial-tooltip"

describe("TutorialTooltip", () => {
  it("uses the root-level opaque shell background outside the app shell", () => {
    render(
      <TutorialTooltip
        {...({
          index: 0,
          step: { content: "Learn this lesson", title: "Lesson" },
          size: 1,
          isLastStep: true,
          backProps: {},
          primaryProps: {},
          skipProps: {},
          controls: { next: vi.fn(), prev: vi.fn(), skip: vi.fn() },
          tooltipProps: {},
        } as unknown as TooltipRenderProps)}
      />,
    )

    expect(screen.getByText("Lesson").parentElement?.parentElement?.getAttribute("style")).toContain(
      "var(--shell-bg-deep)",
    )
  })
})
