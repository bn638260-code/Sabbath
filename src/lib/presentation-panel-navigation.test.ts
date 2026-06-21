// @vitest-environment jsdom
import type { KeyboardEvent } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  handlePresentationPanelArrowKey,
  isPresentationNavigationEditableTarget,
} from "./presentation-panel-navigation"
import type { PresentationRenderData, Verse } from "@/types"

// advanceScripture (run on the navigation chain) touches bibleActions; stub it
// so the microtask after a successful dispatch doesn't reach the Tauri bridge.
vi.mock("@/hooks/use-bible", () => ({
  bibleActions: {
    loadChapter: vi.fn(async () => []),
    fetchVerse: vi.fn(async () => null),
  },
}))

function makeEvent(
  overrides: Partial<KeyboardEvent<HTMLElement>> & { target?: EventTarget }
): KeyboardEvent<HTMLElement> {
  return {
    key: "ArrowRight",
    defaultPrevented: false,
    repeat: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    target: document.createElement("div"),
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as KeyboardEvent<HTMLElement>
}

const verse: Verse = {
  id: 1,
  translation_id: 1,
  book_number: 43,
  book_name: "John",
  book_abbreviation: "John",
  chapter: 3,
  verse: 16,
  text: "For God so loved the world.",
}

const scriptureItem = {
  kind: "scripture",
  reference: "John 3:16",
  scripture: verse,
} as unknown as PresentationRenderData

afterEach(() => {
  vi.clearAllMocks()
})

describe("isPresentationNavigationEditableTarget", () => {
  it("treats text-editing and interactive controls as editable", () => {
    for (const tag of ["input", "textarea", "select", "button"]) {
      expect(
        isPresentationNavigationEditableTarget(document.createElement(tag))
      ).toBe(true)
    }
  })

  it("treats contenteditable and ARIA widget roles as editable", () => {
    const editable = document.createElement("div")
    editable.setAttribute("contenteditable", "true")
    expect(isPresentationNavigationEditableTarget(editable)).toBe(true)

    const option = document.createElement("div")
    option.setAttribute("role", "option")
    expect(isPresentationNavigationEditableTarget(option)).toBe(true)
  })

  it("treats a bare panel container as non-editable", () => {
    const panel = document.createElement("div")
    expect(isPresentationNavigationEditableTarget(panel)).toBe(false)
  })

  it("returns false for null and non-HTMLElement targets", () => {
    expect(isPresentationNavigationEditableTarget(null)).toBe(false)
  })
})

describe("handlePresentationPanelArrowKey", () => {
  it.each([
    ["ctrlKey", { ctrlKey: true }],
    ["metaKey", { metaKey: true }],
    ["altKey", { altKey: true }],
    ["shiftKey", { shiftKey: true }],
    ["repeat", { repeat: true }],
    ["defaultPrevented", { defaultPrevented: true }],
  ])("ignores the key when %s is set", (_label, overrides) => {
    const resolve = vi.fn(() => ({ item: scriptureItem, isLive: false }))
    const event = makeEvent(overrides)
    handlePresentationPanelArrowKey(event, resolve)
    expect(resolve).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it("ignores keys when the target is an editable control", () => {
    const resolve = vi.fn(() => ({ item: scriptureItem, isLive: false }))
    const event = makeEvent({ target: document.createElement("input") })
    handlePresentationPanelArrowKey(event, resolve)
    expect(resolve).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it("ignores non-arrow keys", () => {
    const resolve = vi.fn(() => ({ item: scriptureItem, isLive: false }))
    const event = makeEvent({ key: "Enter" })
    handlePresentationPanelArrowKey(event, resolve)
    expect(resolve).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it("does not preventDefault when there is nothing to advance", () => {
    const resolve = vi.fn(() => ({ item: null, isLive: false }))
    const event = makeEvent({ key: "ArrowRight" })
    handlePresentationPanelArrowKey(event, resolve)
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it("preventDefaults when a staged verse can be advanced", () => {
    const resolve = vi.fn(() => ({ item: scriptureItem, isLive: false }))
    const event = makeEvent({ key: "ArrowLeft" })
    handlePresentationPanelArrowKey(event, resolve)
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(event.preventDefault).toHaveBeenCalledTimes(1)
  })
})
