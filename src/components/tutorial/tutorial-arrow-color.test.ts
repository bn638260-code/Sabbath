import { describe, expect, it } from "vitest"
import { getTutorialArrowColor } from "./tutorial-arrow-color"

function style(
  backgroundImage: string,
  backgroundColor = "rgba(0, 0, 0, 0)"
) {
  return { backgroundImage, backgroundColor } as CSSStyleDeclaration
}

describe("getTutorialArrowColor", () => {
  it("uses the first real gradient color instead of transparent backgroundColor", () => {
    expect(
      getTutorialArrowColor(
        style(
          "linear-gradient(145deg, rgba(13, 20, 38, 0.65), rgba(4, 7, 16, 0.9))"
        )
      )
    ).toBe("rgba(13, 20, 38, 0.65)")
  })

  it("skips gradient direction tokens", () => {
    expect(
      getTutorialArrowColor(
        style(
          "linear-gradient(to bottom right, rgb(13, 20, 38), rgb(4, 7, 16))"
        )
      )
    ).toBe("rgb(13, 20, 38)")
  })

  it("falls back to backgroundColor when no gradient color is present", () => {
    expect(getTutorialArrowColor(style("none", "rgb(13, 20, 38)"))).toBe(
      "rgb(13, 20, 38)"
    )
  })

  it("extracts hwb gradient colors", () => {
    expect(
      getTutorialArrowColor(
        style("linear-gradient(145deg, hwb(210 10% 20%), black)")
      )
    ).toBe("hwb(210 10% 20%)")
  })

  it("extracts named gradient colors", () => {
    expect(
      getTutorialArrowColor(
        style("linear-gradient(145deg, rebeccapurple, black)")
      )
    ).toBe("rebeccapurple")
  })

  it("skips conic gradient prelude tokens before the first color", () => {
    expect(
      getTutorialArrowColor(
        style("conic-gradient(from 45deg at center, rebeccapurple, black)")
      )
    ).toBe("rebeccapurple")
  })

  it("skips radial gradient size keywords before the first color", () => {
    expect(
      getTutorialArrowColor(
        style("radial-gradient(closest-side, rebeccapurple, black)")
      )
    ).toBe("rebeccapurple")
  })

  it("skips radial gradient corner keywords without shape tokens", () => {
    expect(
      getTutorialArrowColor(
        style("radial-gradient(farthest-corner, rebeccapurple, black)")
      )
    ).toBe("rebeccapurple")
  })

  it("skips conic interpolation keywords before the first color", () => {
    expect(
      getTutorialArrowColor(
        style("conic-gradient(in hsl longer hue, rebeccapurple, black)")
      )
    ).toBe("rebeccapurple")
  })
})
