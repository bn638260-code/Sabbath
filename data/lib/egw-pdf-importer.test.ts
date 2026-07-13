import { describe, expect, it } from "vitest"
import { findChapterAnchor, stripChapterFurniture } from "./egw-pdf-importer"

describe("findChapterAnchor", () => {
  it("matches an anchor with a page marker interleaved in a wrapped title", () => {
    // en_DA.pdf wraps ch. 75's title and a printed-page marker lands between
    // the lines: "Chapter 75-Before Annas and the Court of [698] Caiaphas".
    // An exact-string search misses it and falls back to the TOC entry,
    // breaking chapter ordering.
    const text =
      "TOC: Chapter 75-Before Annas and the Court of Caiaphas . . 609 body " +
      "Chapter 75-Before Annas and the Court of [698] Caiaphas This chapter is based on"
    const match = findChapterAnchor(
      text,
      "Chapter 75-Before Annas and the Court of Caiaphas",
    )

    expect(match).not.toBeNull()
    expect(text.slice(match!.pos, match!.pos + match!.length)).toBe(
      "Chapter 75-Before Annas and the Court of [698] Caiaphas",
    )
  })

  it("returns the last occurrence for a plain anchor", () => {
    const text = "Contents Chapter 74-Gethsemane . . 599 body Chapter 74-Gethsemane [681]"
    const match = findChapterAnchor(text, "Chapter 74-Gethsemane")

    expect(match).not.toBeNull()
    expect(match!.pos).toBe(text.lastIndexOf("Chapter 74-Gethsemane"))
    expect(match!.length).toBe("Chapter 74-Gethsemane".length)
  })

  it("returns null when the anchor is absent", () => {
    expect(findChapterAnchor("no chapters here", "Chapter 1-Missing")).toBeNull()
  })
})

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

  it("removes an even-page header '<page> <Book Title>' without touching the sentence", () => {
    // Header numbers are the PDF file's own print pagination — a DIFFERENT
    // sequence from the standard-edition [n] bracket markers the operator UI
    // cites. Injecting them as [n] mixed two paginations, so headers are
    // dropped entirely; page truth comes from the bracket markers alone.
    const out = stripChapterFurniture(
      "More and more fully would he 10 Education have fulfilled the object of his creation.",
      "Education",
      "Source and Aim of True Education",
    )
    expect(out).not.toContain("[10]")
    expect(out).toContain("would he")
    expect(out).toContain("have fulfilled the object")
    expect(out).not.toMatch(/\d+\s+Education/)
  })

  it("removes an odd-page header '<Chapter Title> <page>' without touching the sentence", () => {
    const out = stripChapterFurniture(
      "the wisdom of God. Source and Aim of True Education 11 More and more fully he lived.",
      "Education",
      "Source and Aim of True Education",
    )
    expect(out).not.toContain("[11]")
    expect(out).not.toContain("11")
    expect(out).toContain("the wisdom of God")
    expect(out).toContain("More and more fully he lived")
  })

  it("removes an odd-page header for a quoted chapter title", () => {
    const out = stripChapterFurniture(
      'He gave back the scepter into the "God With Us" 12 Father\'s hands.',
      "The Desire of Ages",
      '"God With Us"',
    )

    expect(out).not.toContain("12")
    expect(out).toContain("Father's hands")
  })

  it("does not strip a chapter title that starts inside another word", () => {
    const out = stripChapterFurniture(
      "XYZSource and Aim of True Education 11 should remain ordinary text.",
      "Education",
      "Source and Aim of True Education",
    )

    expect(out).toContain("XYZSource and Aim of True Education 11")
  })
})
