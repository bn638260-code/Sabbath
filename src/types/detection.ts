import type { EgwParagraph } from "./egw"

export interface DetectionResult {
  content_type?: "bible" | "egw"
  verse_ref: string
  verse_text: string
  book_name: string
  book_number: number
  chapter: number
  verse: number
  confidence: number
  source: "direct" | "semantic"
  auto_queued: boolean
  transcript_snippet: string
  /** True when detected from a chapter-only reference (verse defaults to 1, may be refined). */
  is_chapter_only: boolean
  egw_paragraph?: EgwParagraph | null
}

export interface ReadingAdvance {
  book_number: number
  book_name: string
  chapter: number
  verse: number
  verse_text: string
  reference: string
  confidence: number
}

export interface DetectionStatus {
  has_direct: boolean
  has_semantic: boolean
  paraphrase_enabled: boolean
}

export interface SemanticSearchResult {
  verse_ref: string
  verse_text: string
  book_name: string
  book_number: number
  chapter: number
  verse: number
  similarity: number
}
