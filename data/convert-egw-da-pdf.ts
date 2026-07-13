import { join } from "node:path"
import {
  importEgwPdf,
  type EgwBookConfig,
  type EgwDraftChapter,
} from "./lib/egw-pdf-importer"

const CHAPTERS = [
  { chapter: 1, title: "\"God With Us\"" },
  { chapter: 2, title: "The Chosen People" },
  { chapter: 3, title: "\"The Fullness of the Time\"" },
  { chapter: 4, title: "Unto You a Saviour" },
  { chapter: 5, title: "The Dedication" },
  { chapter: 6, title: "\"We Have Seen His Star\"" },
  { chapter: 7, title: "As a Child" },
  { chapter: 8, title: "The Passover Visit" },
  { chapter: 9, title: "Days of Conflict" },
  { chapter: 10, title: "The Voice in the Wilderness" },
  { chapter: 11, title: "The Baptism" },
  { chapter: 12, title: "The Temptation" },
  { chapter: 13, title: "The Victory" },
  { chapter: 14, title: "\"We Have Found the Messias\"" },
  { chapter: 15, title: "At the Marriage Feast" },
  { chapter: 16, title: "In His Temple" },
  { chapter: 17, title: "Nicodemus" },
  { chapter: 18, title: "\"He Must Increase\"" },
  { chapter: 19, title: "At Jacob's Well" },
  { chapter: 20, title: "\"Except Ye See Signs and Wonders\"" },
  { chapter: 21, title: "Bethesda and the Sanhedrin" },
  { chapter: 22, title: "Imprisonment and Death of John" },
  { chapter: 23, title: "\"The Kingdom of God Is at Hand\"" },
  { chapter: 24, title: "\"Is Not This the Carpenter's Son?\"" },
  { chapter: 25, title: "The Call by the Sea" },
  { chapter: 26, title: "At Capernaum" },
  { chapter: 27, title: "\"Thou Canst Make Me Clean\"" },
  { chapter: 28, title: "Levi-Matthew" },
  { chapter: 29, title: "The Sabbath" },
  { chapter: 30, title: "\"He Ordained Twelve\"" },
  { chapter: 31, title: "The Sermon on the Mount" },
  { chapter: 32, title: "The Centurion" },
  { chapter: 33, title: "Who Are My Brethren?" },
  { chapter: 34, title: "The Invitation" },
  { chapter: 35, title: "\"Peace, Be Still\"" },
  { chapter: 36, title: "The Touch of Faith" },
  { chapter: 37, title: "The First Evangelists" },
  { chapter: 38, title: "Come Rest Awhile" },
  { chapter: 39, title: "\"Give Ye Them to Eat\"" },
  { chapter: 40, title: "A Night on the Lake" },
  { chapter: 41, title: "The Crisis in Galilee" },
  { chapter: 42, title: "Tradition" },
  { chapter: 43, title: "Barriers Broken Down" },
  { chapter: 44, title: "The True Sign" },
  { chapter: 45, title: "The Foreshadowing of the Cross" },
  { chapter: 46, title: "He Was Transfigured" },
  { chapter: 47, title: "Ministry" },
  { chapter: 48, title: "Who Is the Greatest?" },
  { chapter: 49, title: "At the Feast of Tabernacles" },
  { chapter: 50, title: "Among Snares" },
  { chapter: 51, title: "\"The Light of Life\"" },
  { chapter: 52, title: "The Divine Shepherd" },
  { chapter: 53, title: "The Last Journey From Galilee" },
  { chapter: 54, title: "The Good Samaritan" },
  { chapter: 55, title: "Not With Outward Show" },
  { chapter: 56, title: "Blessing the Children" },
  { chapter: 57, title: "\"One Thing Thou Lackest\"" },
  { chapter: 58, title: "\"Lazarus, Come Forth\"" },
  { chapter: 59, title: "Priestly Plottings" },
  { chapter: 60, title: "The Law of the New Kingdom" },
  { chapter: 61, title: "Zacchaeus" },
  { chapter: 62, title: "The Feast at Simon's House" },
  { chapter: 63, title: "\"Thy King Cometh\"" },
  { chapter: 64, title: "A Doomed People" },
  { chapter: 65, title: "The Temple Cleansed Again" },
  { chapter: 66, title: "Controversy" },
  { chapter: 67, title: "Woes on the Pharisees" },
  { chapter: 68, title: "In the Outer Court" },
  { chapter: 69, title: "On the Mount of Olives" },
  { chapter: 70, title: "\"The Least of These My Brethren\"" },
  { chapter: 71, title: "A Servant of Servants" },
  { chapter: 72, title: "\"In Remembrance of Me\"" },
  { chapter: 73, title: "\"Let Not Your Heart Be Troubled\"" },
  { chapter: 74, title: "Gethsemane" },
  { chapter: 75, title: "Before Annas and the Court of Caiaphas" },
  { chapter: 76, title: "Judas" },
  { chapter: 77, title: "In Pilate's Judgment Hall" },
  { chapter: 78, title: "Calvary" },
  { chapter: 79, title: "\"It is Finished\"" },
  { chapter: 80, title: "In Joseph's Tomb" },
  { chapter: 81, title: "\"The Lord Is Risen\"" },
  { chapter: 82, title: "\"Why Weepest Thou?\"" },
  { chapter: 83, title: "The Walk to Emmaus" },
  { chapter: 84, title: "\"Peace Be Unto You\"" },
  { chapter: 85, title: "By the Sea Once More" },
  { chapter: 86, title: "Go Teach All Nations" },
  { chapter: 87, title: "\"To My Father, and Your Father\"" },
] as const

const inputPdf =
  process.argv[2] ?? String.raw`C:\Users\fanel\Downloads\The-Desire-of-Ages (1).pdf`

type DaParagraph = EgwDraftChapter["paragraphs"][number]

function normalizeJoinedText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+(["'])\./g, "$1.")
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

function mergeParagraphs(
  paragraphs: DaParagraph[],
  textTransform: (text: string) => string = (text) => text,
): DaParagraph {
  const [first] = paragraphs
  if (!first) {
    throw new Error("Cannot merge an empty Desire of Ages range")
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
      paragraphs
        .map((paragraph) => textTransform(paragraph.text))
        .join(" "),
    ),
  }
}

function stripLeadingPdfFolio(text: string): string {
  return text.replace(/^\d{1,4}\s+(?=[a-z])/, "")
}

function alignChapter1CanonicalParagraphs(
  chapter: EgwDraftChapter,
): EgwDraftChapter {
  if (chapter.chapter !== 1) return chapter

  const aligned: DaParagraph[] = []
  for (let index = 0; index < chapter.paragraphs.length; index += 1) {
    const current = chapter.paragraphs[index]
    const next = chapter.paragraphs[index + 1]

    if (
      current?.text.startsWith("In the beginning, God was revealed") &&
      next?.text.startsWith("9 earth with beauty")
    ) {
      aligned.push(mergeParagraphs([current, next], stripLeadingPdfFolio))
      index += 1
      continue
    }

    if (
      current?.text.startsWith("The work of redemption will be complete") &&
      next?.text.startsWith('Immanuel, "God with us')
    ) {
      aligned.push(mergeParagraphs([current, next]))
      index += 1
      continue
    }

    if (current) aligned.push(current)
  }

  return renumberChapter({ ...chapter, paragraphs: aligned })
}

function alignDesireOfAgesCanonicalParagraphs(
  chapters: EgwDraftChapter[],
): EgwDraftChapter[] {
  return chapters.map(alignChapter1CanonicalParagraphs)
}

const config: EgwBookConfig = {
  title: "The Desire of Ages",
  abbreviation: "DA",
  book_number: 3,
  chapterAnchorTemplate: "Chapter {chapter}-{title}",
  expectedChapterCount: 87,
  pdfPath: inputPdf,
  outputJsonPath: join(
    import.meta.dir,
    "sources",
    "egw",
    "the-desire-of-ages.json",
  ),
  debugSlug: "the-desire-of-ages",
  pageSource: "brackets",
  // Chapter titles render in a ~17pt display font over ~14pt body text. A long
  // title (e.g. ch. 75 "Before Annas and the Court of / Caiaphas") wraps to a
  // centered second line whose large indent would otherwise be read as a new
  // paragraph, splitting the title and breaking anchor matching. Treating tall
  // heading-font lines as non-breaking keeps wrapped titles intact.
  layout: { headingHeightRatio: 1.1 },
  requiredTokens: [
    "Contents",
    'Chapter 1-"God With Us"',
    'Chapter 87-"To My Father, and Your Father"',
  ],
  splitReadableParagraphs: false,
  countContinuedPagesForPageParagraphs: false,
  postprocessChapters: alignDesireOfAgesCanonicalParagraphs,
  chapters: CHAPTERS,
}

async function main() {
  await importEgwPdf(config)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
