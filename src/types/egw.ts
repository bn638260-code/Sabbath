export interface EgwBook {
  id: number
  book_number: number
  title: string
  abbreviation: string
  chapter_count: number
}

export interface EgwChapterInfo {
  chapter: number
  title: string
  paragraph_count: number
}

export interface EgwSemanticStatus {
  ready: boolean
  building: boolean
  model_available: boolean
  has_content: boolean
}

export interface EgwSemanticResult {
  paragraph: EgwParagraph
  score: number
  source: string
}

export interface EgwParagraph {
  id: number
  book_number: number
  book_title: string
  chapter: number
  chapter_title: string
  paragraph: number
  text: string
}