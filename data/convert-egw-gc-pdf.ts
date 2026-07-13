import { join } from "node:path"
import { importEgwPdf, type EgwBookConfig } from "./lib/egw-pdf-importer"

const CHAPTERS = [
  { chapter: 1, title: "The Destruction of Jerusalem" },
  { chapter: 2, title: "Persecution in the First Centuries" },
  { chapter: 3, title: "An Era of Spiritual Darkness" },
  { chapter: 4, title: "The Waldenses" },
  { chapter: 5, title: "John Wycliffe" },
  { chapter: 6, title: "Huss and Jerome" },
  { chapter: 7, title: "Luther's Separation From Rome" },
  { chapter: 8, title: "Luther Before the Diet" },
  { chapter: 9, title: "The Swiss Reformer" },
  { chapter: 10, title: "Progress of Reform in Germany" },
  { chapter: 11, title: "Protest of the Princes" },
  { chapter: 12, title: "The French Reformation" },
  { chapter: 13, title: "The Netherlands and Scandinavia" },
  { chapter: 14, title: "Later English Reformers" },
  { chapter: 15, title: "The Bible and the French Revolution" },
  { chapter: 16, title: "The Pilgrim Fathers" },
  { chapter: 17, title: "Heralds of the Morning" },
  { chapter: 18, title: "An American Reformer" },
  { chapter: 19, title: "Light Through Darkness" },
  { chapter: 20, title: "A Great Religious Awakening" },
  { chapter: 21, title: "A Warning Rejected" },
  { chapter: 22, title: "Prophecies Fulfilled" },
  { chapter: 23, title: "What is the Sanctuary?" },
  { chapter: 24, title: "In the Holy of Holies" },
  { chapter: 25, title: "God's Law Immutable" },
  { chapter: 26, title: "A Work of Reform" },
  { chapter: 27, title: "Modern Revivals" },
  { chapter: 28, title: "Facing Life's Record" },
  { chapter: 29, title: "The Origin of Evil" },
  { chapter: 30, title: "Enmity Between Man and Satan" },
  { chapter: 31, title: "Agency of Evil Spirits" },
  { chapter: 32, title: "Snares of Satan" },
  { chapter: 33, title: "The First Great Deception" },
  { chapter: 34, title: "Can Our Dead Speak to Us?" },
  { chapter: 35, title: "Liberty of Conscience Threatened" },
  { chapter: 36, title: "The Impending Conflict" },
  { chapter: 37, title: "The Scriptures a Safeguard" },
  { chapter: 38, title: "The Final Warning" },
  { chapter: 39, title: "The Time of Trouble" },
  { chapter: 40, title: "God's People Delivered" },
  { chapter: 41, title: "Desolation of the Earth" },
  { chapter: 42, title: "The Controversy Ended" },
] as const

const inputPdf =
  process.argv[2] ?? String.raw`C:\Users\fanel\Downloads\en_GC.pdf`

const config: EgwBookConfig = {
  title: "The Great Controversy",
  abbreviation: "GC",
  book_number: 5,
  chapterAnchorTemplate: "Chapter {chapter}-{title}",
  expectedChapterCount: 42,
  pdfPath: inputPdf,
  outputJsonPath: join(
    import.meta.dir,
    "sources",
    "egw",
    "the-great-controversy.json"
  ),
  debugSlug: "en_GC",
  pageSource: "folios",
  requiredTokens: [
    "Contents",
    "Chapter 1-The Destruction of Jerusalem",
    "Chapter 42-The Controversy Ended",
  ],
  appendixMarker: "Appendix",
  splitReadableParagraphs: false,
  countContinuedPagesForPageParagraphs: false,
  chapters: CHAPTERS,
}

async function main() {
  await importEgwPdf(config)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
