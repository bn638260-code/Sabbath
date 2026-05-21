import { SDA_HYMNAL_CHUNKS } from "@/data/sda-hymnal-chunks"
import { SDA_HYMNAL_INDEX } from "@/data/sda-hymnal-index"
import type { Hymn, HymnSearchResult } from "@/types"

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
}

export function searchHymns(query: string, limit = 20): HymnSearchResult[] {
  const trimmed = query.trim()
  if (!trimmed) return SDA_HYMNAL_INDEX.slice(0, limit)

  const q = normalized(trimmed)
  const number = Number(trimmed)
  const ranked = SDA_HYMNAL_INDEX
    .map((hymn) => {
      const title = normalized(hymn.title)
      const firstLine = normalized(hymn.firstLine ?? "")
      let score = 0

      if (Number.isInteger(number) && hymn.number === number) score += 100
      if (String(hymn.number).startsWith(trimmed)) score += 40
      if (title === q) score += 80
      if (title.startsWith(q)) score += 50
      if (title.includes(q)) score += 30
      if (firstLine.includes(q)) score += 20

      return { hymn, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.hymn.number - b.hymn.number)

  return ranked.slice(0, limit).map((entry) => entry.hymn)
}

export async function getHymnById(id: string): Promise<Hymn | null> {
  const result = SDA_HYMNAL_INDEX.find((hymn) => hymn.id === id)
  return result ? getHymnByNumber(result.number) : null
}

export async function getHymnByNumber(number: number): Promise<Hymn | null> {
  const chunk = SDA_HYMNAL_CHUNKS.find(
    (candidate) => number >= candidate.start && number <= candidate.end,
  )
  if (!chunk) return null

  const hymns = await chunk.load()
  return hymns.find((hymn) => hymn.number === number) ?? null
}

export function getInitialHymns(limit = 12): HymnSearchResult[] {
  return SDA_HYMNAL_INDEX.slice(0, limit)
}
