// Generated from C:/Users/fanel/Downloads/sda-hymnal-master/sda-hymnal-master/data/hymns.db.
// Source package: sda-hymnal v1.0.4, MIT license.
import type { Hymn } from "@/types/hymnal"

export interface HymnalChunkLoader {
  start: number
  end: number
  load: () => Promise<readonly Hymn[]>
}

export const SDA_HYMNAL_CHUNKS: HymnalChunkLoader[] = [
  { start: 1, end: 100, load: () => import("./sda-hymnal-chunks/sda-hymnal-001-100").then((mod) => mod.HYMNS) },
  { start: 101, end: 200, load: () => import("./sda-hymnal-chunks/sda-hymnal-101-200").then((mod) => mod.HYMNS) },
  { start: 201, end: 300, load: () => import("./sda-hymnal-chunks/sda-hymnal-201-300").then((mod) => mod.HYMNS) },
  { start: 301, end: 400, load: () => import("./sda-hymnal-chunks/sda-hymnal-301-400").then((mod) => mod.HYMNS) },
  { start: 401, end: 500, load: () => import("./sda-hymnal-chunks/sda-hymnal-401-500").then((mod) => mod.HYMNS) },
  { start: 501, end: 600, load: () => import("./sda-hymnal-chunks/sda-hymnal-501-600").then((mod) => mod.HYMNS) },
  { start: 601, end: 695, load: () => import("./sda-hymnal-chunks/sda-hymnal-601-695").then((mod) => mod.HYMNS) },
]
