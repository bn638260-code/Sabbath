import { describe, expect, it } from "vitest"
import { stripChapterFurniture } from "./egw-pdf-importer"

describe("stripChapterFurniture", () => {
  it("keeps an ordinary title word that is not part of a running header", () => {
    // Regression for the Education bug: a global `\bEducation\b` strip deleted
    // every occurrence of the book's own title word, turning the opening
    // sentence into "Our ideas of take too narrow a range."
    const out = stripChapterFurniture(
      "Our ideas of education take too narrow and too low a range.",
      "Education",
      "Source and Aim of True Education",
    )
    expect(out).toContain("ideas of education take")
  })

  it("keeps a multi-word title phrase that appears in ordinary prose", () => {
    // The Great Controversy strip (case-insensitive) deleted the book's central
    // phrase "the great controversy" from the body text everywhere.
    const out = stripChapterFurniture(
      "This is the great controversy between Christ and Satan.",
      "The Great Controversy",
      "The Destruction of Jerusalem",
    )
    expect(out.toLowerCase()).toContain("great controversy between christ")
  })

  it("converts an even-page header '<page> <Book Title>' into a page marker", () => {
    // The running header interrupts a page-spanning sentence, and its number is
    // the only signal for that printed page, so it must survive as a [n] marker
    // rather than being deleted (which lost pages 9-13 of Education entirely).
    const out = stripChapterFurniture(
      "More and more fully would he 10 Education have fulfilled the object of his creation.",
      "Education",
      "Source and Aim of True Education",
    )
    expect(out).toContain("[10]")
    expect(out).toContain("would he")
    expect(out).toContain("have fulfilled the object")
    expect(out).not.toMatch(/\d+\s+Education/)
  })

  it("converts an odd-page header '<Chapter Title> <page>' into a page marker", () => {
    const out = stripChapterFurniture(
      "the wisdom of God. Source and Aim of True Education 11 More and more fully he lived.",
      "Education",
      "Source and Aim of True Education",
    )
    expect(out).toContain("[11]")
    expect(out).toContain("the wisdom of God")
    expect(out).toContain("More and more fully he lived")
  })

  it("converts an odd-page header for a quoted chapter title", () => {
    const out = stripChapterFurniture(
      'He gave back the scepter into the "God With Us" 12 Father\'s hands.',
      "The Desire of Ages",
      '"God With Us"',
    )

    expect(out).toContain("[12]")
    expect(out).toContain("Father's hands")
  })

  it("does not convert a chapter title that starts inside another word", () => {
    const out = stripChapterFurniture(
      "XYZSource and Aim of True Education 11 should remain ordinary text.",
      "Education",
      "Source and Aim of True Education",
    )

    expect(out).toContain("XYZSource and Aim of True Education 11")
    expect(out).not.toContain("[11]")
  })
})
