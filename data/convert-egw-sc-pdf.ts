import { join } from "node:path"
import { importEgwPdf, type EgwBookConfig } from "./lib/egw-pdf-importer"

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
  process.argv[2] ?? String.raw`C:\Users\fanel\Downloads\Steps-to-Christ (1).pdf`

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
