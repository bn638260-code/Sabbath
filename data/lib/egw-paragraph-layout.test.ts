import { describe, expect, test } from "bun:test"
import { reconstructPageParagraphs, type PdfTextItemLike } from "./egw-paragraph-layout"

// Helper: a text item at (x, y) with font height h.
function item(str: string, x: number, y: number, h = 10): PdfTextItemLike {
  return { str, transform: [h, 0, 0, h, x, y], width: str.length * 5, height: h }
}

// Body column starts at x=50; first-line indent at x=68 (1.8em of h=10);
// line spacing 14 units.
describe("reconstructPageParagraphs", () => {
  test("splits paragraphs at first-line indents", () => {
    const items = [
      item("God is love. His nature,", 68, 700), // indented → para 1 start
      item("his law, is love.", 50, 686),
      item("The history of the great", 68, 672), // indented → para 2 start
      item("conflict is unfolded.", 50, 658),
    ]
    const page = reconstructPageParagraphs(items)
    expect(page.text.split(/\n\s*\n/)).toHaveLength(2)
    expect(page.text).toContain("God is love. His nature,\nhis law, is love.")
    expect(page.continuesFromPreviousPage).toBe(false)
  })

  test("splits paragraphs at oversized vertical gaps", () => {
    const items = [
      item("First paragraph line one.", 50, 700),
      item("First paragraph line two.", 50, 686),
      item("First paragraph line three.", 50, 672), // modal line gap = 14
      item("Second paragraph after a gap.", 50, 636), // 36 > 1.7 × 14
    ]
    const page = reconstructPageParagraphs(items)
    expect(page.text.split(/\n\s*\n/)).toHaveLength(2)
  })

  test("keeps a single unindented flow as one paragraph", () => {
    const items = [
      item("Line one continues", 50, 700),
      item("line two continues", 50, 686),
      item("line three.", 50, 672),
    ]
    const page = reconstructPageParagraphs(items)
    expect(page.text.split(/\n\s*\n/)).toHaveLength(1)
  })

  test("flags continuation when page starts unindented mid-flow", () => {
    const continuing = reconstructPageParagraphs([
      item("carried over from previous page,", 50, 700),
      item("and it ends here.", 50, 686),
    ])
    expect(continuing.continuesFromPreviousPage).toBe(true)

    const fresh = reconstructPageParagraphs([
      item("A brand new paragraph.", 68, 700),
      item("continued line.", 50, 686),
    ])
    expect(fresh.continuesFromPreviousPage).toBe(false)
  })

  test("keeps standalone page-number lines as their own line without breaking paragraphs", () => {
    const items = [
      item("21", 300, 720), // centered folio
      item("Text of the paragraph starts", 68, 700),
      item("and continues on.", 50, 686),
    ]
    const page = reconstructPageParagraphs(items)
    // folio stays a standalone line (single \n), not merged into the sentence
    expect(page.text).toMatch(/^21\n/)
    expect(page.text.split(/\n\s*\n/).length).toBe(1 + 1) // folio chunk + paragraph
  })

  test("returns empty text for empty input", () => {
    expect(reconstructPageParagraphs([]).text).toBe("")
  })
})
