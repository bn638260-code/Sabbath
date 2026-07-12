import { describe, expect, it } from "vitest"
import { cleanEgwParagraphs } from "./egw-text-cleanup"

const options = {
  bookTitle: "The Desire of Ages",
  chapterTitle: '"God With Us"',
}

describe("EGW text cleanup", () => {
  it("merges a paragraph split by PDF page numbers", () => {
    const paragraphs = cleanEgwParagraphs(
      [
        {
          paragraph: 1,
          text: "It was He that filled the 9",
        },
        {
          paragraph: 2,
          text: "10 earth with beauty, and the air with song.",
        },
      ],
      options,
    )

    expect(paragraphs).toEqual([
      {
        paragraph: 1,
        text: "It was He that filled the earth with beauty, and the air with song.",
      },
    ])
  })

  it("strips running chapter headers before continuation text", () => {
    const paragraphs = cleanEgwParagraphs(
      [
        {
          paragraph: 1,
          text: "He gave back the scepter into the",
        },
        {
          paragraph: 2,
          text: '"God With Us" 12 Father\'s hands, and stepped down.',
        },
      ],
      options,
    )

    expect(paragraphs[0]?.text).toBe(
      "He gave back the scepter into the Father's hands, and stepped down.",
    )
  })

  it("strips running chapter headers reconstructed after a page split", () => {
    const paragraphs = cleanEgwParagraphs(
      [
        {
          paragraph: 1,
          text: "If they had walked in the",
        },
        {
          paragraph: 2,
          text: "Chosen People 17 ways of obedience, the witness would have been clear.",
        },
      ],
      {
        bookTitle: "The Desire of Ages",
        chapterTitle: "The Chosen People",
      },
    )

    expect(paragraphs[0]?.text).toBe(
      "If they had walked in the ways of obedience, the witness would have been clear.",
    )
  })

  it("does not merge complete adjacent paragraphs", () => {
    const paragraphs = cleanEgwParagraphs(
      [
        {
          paragraph: 1,
          text: "This paragraph is complete. 9",
        },
        {
          paragraph: 2,
          text: "10 Another paragraph begins with a complete thought.",
        },
      ],
      options,
    )

    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0]?.text).toBe("This paragraph is complete.")
    expect(paragraphs[1]?.text).toBe(
      "Another paragraph begins with a complete thought.",
    )
  })

  it("merges a same-page sentence split that has no page artifact", () => {
    // The layout heuristics sometimes break one sentence in two on the same
    // page (e.g. the Education ch.1 epigraph). Neither fragment carries a page
    // artifact, but the first has no closing punctuation and the second
    // continues it in lower case, so they must be rejoined.
    const paragraphs = cleanEgwParagraphs(
      [
        {
          paragraph: 1,
          page: 8,
          text: 'the knowledge of the holy is understanding; "Acquaint now',
        },
        { paragraph: 2, page: 8, text: 'thyself with Him."' },
      ],
      options,
    )

    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0]?.text).toContain("Acquaint now thyself with Him")
  })

  it("merges a continuation that spans a printed page and records the span", () => {
    const paragraphs = cleanEgwParagraphs(
      [
        { paragraph: 1, page: 9, text: "More and more fully would he" },
        {
          paragraph: 2,
          page: 10,
          text: "have fulfilled the object of his creation.",
        },
      ],
      options,
    )

    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0]?.text).toBe(
      "More and more fully would he have fulfilled the object of his creation.",
    )
    expect(paragraphs[0]?.page).toBe(9)
    expect(paragraphs[0]?.continued_pages).toContain(10)
  })

  it("restores Desire of Ages Sabbath text damaged by the legacy importer", () => {
    const paragraphs = cleanEgwParagraphs(
      [
        {
          paragraph: 1,
          text: "was hallowed at the creation. Because He had rested upon, God blessed the seventh day.",
        },
        {
          paragraph: 2,
          text: "And since is a memorial of the work of creation, it is a token of the love and power of Christ.",
        },
      ],
      {
        bookTitle: "The Desire of Ages",
        chapterTitle: "The Sabbath",
      },
    )

    expect(paragraphs[0]?.text).toContain(
      "The Sabbath was hallowed at the creation.",
    )
    expect(paragraphs[0]?.text).toContain(
      "Because He had rested upon the Sabbath, God blessed the seventh day.",
    )
    expect(paragraphs[1]?.text).toContain(
      "And since the Sabbath is a memorial of the work of creation",
    )
  })

  it("re-splits long healed page runs into readable sentence groups", () => {
    const longText = [
      "This opening sentence introduces the theme and keeps enough words in place to behave like a real book paragraph.",
      "This second sentence adds another complete thought that should stay near the opening because the group is still readable.",
      "This third sentence extends the thought with additional detail for the reader and helps force a split near the soft limit.",
      "This fourth sentence begins a fresh readable paragraph rather than being glued into one oversized wall of text.",
      "This fifth sentence closes the example with a final complete thought.",
      "This sixth sentence adds enough additional language to cross the readable paragraph limit and prove that repaired page runs are divided again.",
      "This seventh sentence supplies a final complete thought for the second generated paragraph.",
      "This eighth sentence keeps the fixture comfortably above the readable paragraph ceiling so the behavior is exercised.",
      "This ninth sentence adds ordinary prose that still looks like book text after the cleanup has removed the page marker.",
      "This tenth sentence gives the cleanup one more complete thought to place into a later readable paragraph.",
    ].join(" ")

    const paragraphs = cleanEgwParagraphs(
      [
        {
          paragraph: 1,
          text: `${longText} 9`,
        },
      ],
      options,
    )

    expect(paragraphs.length).toBeGreaterThan(1)
    expect(paragraphs.every((paragraph) => paragraph.text.length <= 850)).toBe(
      true,
    )
  })
})
