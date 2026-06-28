/**
 * Golden benchmark cases for Afrikaans Bible semantic retrieval.
 * Run with the multilingual embedding index once precomputed.
 */
export const AFRIKAANS_SEMANTIC_BENCHMARK = [
  {
    query: "God so lief die wêreld gehad het",
    expectedRef: "Johannes 3:16",
    bookNumber: 43,
    chapter: 3,
    verse: 16,
  },
  {
    query: "Hy is my herder ek sal nie ontbreke nie",
    expectedRef: "Psalms 23:1",
    bookNumber: 19,
    chapter: 23,
    verse: 1,
  },
] as const

export type AfrikaansSemanticBenchmarkCase =
  (typeof AFRIKAANS_SEMANTIC_BENCHMARK)[number]
