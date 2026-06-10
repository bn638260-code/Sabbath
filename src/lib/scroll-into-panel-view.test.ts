// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { findScrollContainer, scrollIntoPanelView } from "./scroll-into-panel-view"

function makeScrollable(element: HTMLElement, scrollHeight: number, clientHeight: number) {
  element.style.overflowY = "auto"
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: scrollHeight })
  Object.defineProperty(element, "clientHeight", { configurable: true, value: clientHeight })
}

function setRect(element: HTMLElement, top: number, height: number) {
  element.getBoundingClientRect = () =>
    ({ top, height, bottom: top + height, left: 0, right: 0, width: 0, x: 0, y: top }) as DOMRect
}

describe("scrollIntoPanelView", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.restoreAllMocks()
  })

  it("scrolls only the nearest scrollable ancestor, never the page", () => {
    // Regression: previewing a recent detection used scrollIntoView, which
    // scrolled every ancestor including the document and yanked the whole
    // app down to the Bible section.
    const page = document.createElement("div")
    makeScrollable(page, 5000, 800)
    const list = document.createElement("div")
    makeScrollable(list, 2000, 400)
    const verse = document.createElement("div")

    page.appendChild(list)
    list.appendChild(verse)
    document.body.appendChild(page)

    setRect(list, 100, 400)
    setRect(verse, 700, 40) // below the visible list area

    const listScrollTo = vi.fn()
    const pageScrollTo = vi.fn()
    list.scrollTo = listScrollTo as unknown as typeof list.scrollTo
    page.scrollTo = pageScrollTo as unknown as typeof page.scrollTo

    scrollIntoPanelView(verse)

    expect(listScrollTo).toHaveBeenCalledTimes(1)
    expect(pageScrollTo).not.toHaveBeenCalled()
    const arg = listScrollTo.mock.calls[0][0] as { top: number }
    // 700 - 100 - (400-40)/2 = 420 offset from current scrollTop (0)
    expect(arg.top).toBe(420)
  })

  it("does nothing when there is no scrollable ancestor", () => {
    const element = document.createElement("div")
    document.body.appendChild(element)
    expect(findScrollContainer(element)).toBeNull()
    expect(() => scrollIntoPanelView(element)).not.toThrow()
  })

  it("ignores null elements", () => {
    expect(() => scrollIntoPanelView(null)).not.toThrow()
  })
})
