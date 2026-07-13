import { join } from "node:path"
import { importEgwPdf, type EgwBookConfig } from "./lib/egw-pdf-importer"

const CHAPTERS = [
  { chapter: 1, title: "Source and Aim of True Education" },
  { chapter: 2, title: "The Eden School" },
  { chapter: 3, title: "The Knowledge of Good and Evil" },
  { chapter: 4, title: "Relation of Education to Redemption" },
  { chapter: 5, title: "The Education of Israel" },
  { chapter: 6, title: "The Schools of the Prophets" },
  { chapter: 7, title: "Lives of Great Men" },
  { chapter: 8, title: "The Teacher Sent From God" },
  { chapter: 9, title: "An Illustration of His Methods" },
  { chapter: 10, title: "God in Nature" },
  { chapter: 11, title: "Lessons of Life" },
  { chapter: 12, title: "Other Object Lessons" },
  { chapter: 13, title: "Mental and Spiritual Culture" },
  { chapter: 14, title: "Science and the Bible" },
  { chapter: 15, title: "Business Principles and Methods" },
  { chapter: 16, title: "Bible Biographies" },
  { chapter: 17, title: "Poetry and Song" },
  { chapter: 18, title: "Mysteries of the Bible" },
  { chapter: 19, title: "History and Prophecy" },
  { chapter: 20, title: "Bible Teaching and Study" },
  { chapter: 21, title: "Study of Physiology" },
  { chapter: 22, title: "Temperance and Dietetics" },
  { chapter: 23, title: "Recreation" },
  { chapter: 24, title: "Manual Training" },
  { chapter: 25, title: "Education and Character" },
  { chapter: 26, title: "Methods of Teaching" },
  { chapter: 27, title: "Deportment" },
  { chapter: 28, title: "Relation of Dress to Education" },
  { chapter: 29, title: "The Sabbath" },
  { chapter: 30, title: "Faith and Prayer" },
  { chapter: 31, title: "The Lifework" },
  { chapter: 32, title: "Preparation" },
  { chapter: 33, title: "Co-operation" },
  { chapter: 34, title: "Discipline" },
  { chapter: 35, title: "The School of the Hereafter" },
] as const

const inputPdf =
  process.argv[2] ?? String.raw`C:\Users\fanel\Downloads\en_Ed (1).pdf`

const config: EgwBookConfig = {
  title: "Education",
  abbreviation: "Ed",
  book_number: 4,
  chapterAnchorTemplate: "Chapter {chapter}-{title}",
  expectedChapterCount: 35,
  pdfPath: inputPdf,
  outputJsonPath: join(import.meta.dir, "sources", "egw", "education.json"),
  debugSlug: "en_Ed",
  pageSource: "brackets",
  requiredTokens: [
    "Contents",
    "Chapter 1-Source and Aim of True Education",
    "Chapter 35-The School of the Hereafter",
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
