import { join } from "node:path"
import {
  importEgwPdf,
  type EgwBookConfig,
  type EgwDraftChapter,
} from "./lib/egw-pdf-importer"

const CHAPTERS = [
  { chapter: 1, title: "God's Love for Man" },
  { chapter: 2, title: "The Sinner's Need of Christ" },
  { chapter: 3, title: "Repentance" },
  { chapter: 4, title: "Confession" },
  { chapter: 5, title: "Consecration" },
  { chapter: 6, title: "Faith and Acceptance" },
  { chapter: 7, title: "The Test of Discipleship" },
  { chapter: 8, title: "Growing Up Into Christ" },
  { chapter: 9, title: "The Work and the Life" },
  { chapter: 10, title: "A Knowledge of God" },
  { chapter: 11, title: "The Privilege of Prayer" },
  { chapter: 12, title: "What to Do with Doubt" },
  { chapter: 13, title: "Rejoicing in the Lord" },
] as const

const inputPdf =
  process.argv[2] ??
  String.raw`C:\Users\fanel\Downloads\Steps-to-Christ (1).pdf`

type ScParagraph = EgwDraftChapter["paragraphs"][number]

function normalizeJoinedText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim()
}

function renumberChapter(chapter: EgwDraftChapter): EgwDraftChapter {
  return {
    ...chapter,
    paragraphs: chapter.paragraphs.map((paragraph, index) => ({
      ...paragraph,
      paragraph: index + 1,
    })),
  }
}

function mergeParagraphs(paragraphs: ScParagraph[]): ScParagraph {
  const [first] = paragraphs
  if (!first) {
    throw new Error("Cannot merge an empty paragraph range")
  }

  const continuedPages = paragraphs.flatMap(
    (paragraph) => paragraph.continued_pages ?? [],
  )

  return {
    paragraph: first.paragraph,
    page: first.page,
    continued_pages:
      continuedPages.length > 0
        ? Array.from(new Set(continuedPages))
        : undefined,
    text: normalizeJoinedText(
      paragraphs.map((paragraph) => paragraph.text).join(" "),
    ),
  }
}

function alignChapter1PsalmBlock(chapter: EgwDraftChapter): EgwDraftChapter {
  if (chapter.chapter !== 1) return chapter

  const paragraphs: ScParagraph[] = []
  for (let index = 0; index < chapter.paragraphs.length; index += 1) {
    const current = chapter.paragraphs[index]
    const next = chapter.paragraphs[index + 1]
    const reference = chapter.paragraphs[index + 2]

    if (
      current?.text.startsWith('"The eyes of all wait upon Thee') &&
      next?.text.startsWith("Thou openest Thine hand") &&
      reference?.text === "Psalm 145:15, 16."
    ) {
      paragraphs.push(mergeParagraphs([current, next, reference]))
      index += 2
      continue
    }

    if (current) paragraphs.push(current)
  }

  return renumberChapter({ ...chapter, paragraphs })
}

function alignChapter3DavidPsalmBlock(
  chapter: EgwDraftChapter,
): EgwDraftChapter {
  if (chapter.chapter !== 3) return chapter

  const paragraphs: ScParagraph[] = []
  for (const paragraph of chapter.paragraphs) {
    const blessedStart = paragraph.text.indexOf(
      '"Blessed is he whose transgression is forgiven',
    )
    const mercyStart = paragraph.text.indexOf('"Have mercy upon me, O God')
    const repentanceStart = paragraph.text.indexOf(
      "A repentance such as this, is beyond",
    )

    if (
      blessedStart === -1 ||
      mercyStart === -1 ||
      repentanceStart === -1 ||
      !(blessedStart < mercyStart && mercyStart < repentanceStart)
    ) {
      paragraphs.push(paragraph)
      continue
    }

    const quotePage = paragraph.continued_pages?.[0] ?? paragraph.page
    const proseText = normalizeJoinedText(paragraph.text.slice(0, blessedStart))
    const psalm32Text = normalizeJoinedText(
      paragraph.text.slice(blessedStart, mercyStart),
    )
    const psalm51Text = normalizeJoinedText(
      paragraph.text.slice(mercyStart, repentanceStart),
    )
    const repentanceText = normalizeJoinedText(
      paragraph.text.slice(repentanceStart),
    )

    paragraphs.push({
      ...paragraph,
      text: proseText,
    })
    paragraphs.push({
      paragraph: paragraph.paragraph,
      page: quotePage,
      text: psalm32Text,
    })
    paragraphs.push({
      paragraph: paragraph.paragraph,
      page: quotePage,
      text: psalm51Text,
    })
    paragraphs.push({
      paragraph: paragraph.paragraph,
      page: quotePage,
      text: repentanceText,
    })
  }

  return renumberChapter({ ...chapter, paragraphs })
}

function alignStepsToChristCanonicalParagraphs(
  chapters: EgwDraftChapter[],
): EgwDraftChapter[] {
  return chapters.map((chapter) =>
    alignChapter3DavidPsalmBlock(alignChapter1PsalmBlock(chapter)),
  )
}

const config: EgwBookConfig = {
  title: "Steps to Christ",
  abbreviation: "SC",
  book_number: 2,
  chapterAnchorTemplate: "Chap. {chapter} - {title}",
  expectedChapterCount: 13,
  pdfPath: inputPdf,
  outputJsonPath: join(
    import.meta.dir,
    "sources",
    "egw",
    "steps-to-christ.json",
  ),
  debugSlug: "steps-to-christ",
  // SC chapter titles render in a ~17pt display font over ~10pt body text.
  // A wrapped title (e.g. ch. 2 "The Sinner's Need of / Christ") puts its
  // second line ~24 units below the first — past the default gap-break
  // threshold — which would split the title and break anchor matching.
  // Treating tall heading-font lines as non-breaking keeps wrapped titles
  // intact; body paragraphs (normal font) are detected as before.
  layout: { headingHeightRatio: 1.1 },
  // EGW Writings exposes SC labels by paragraph start (e.g. SC 10.1 even
  // after a prior paragraph continues onto page 10), so preserve paragraph
  // bodies and do not increment page-paragraph counts for continuations.
  splitReadableParagraphs: false,
  countContinuedPagesForPageParagraphs: false,
  postprocessChapters: alignStepsToChristCanonicalParagraphs,
  requiredTokens: [
    "Contents",
    "Chap. 1 - God's Love for Man",
    "Chap. 13 - Rejoicing in the Lord",
  ],
  chapters: CHAPTERS,
}

async function main() {
  await importEgwPdf(config)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
