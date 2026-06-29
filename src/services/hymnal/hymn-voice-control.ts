import { SDA_HYMNAL_INDEX } from "@/data/sda-hymnal-index"
import { presentItem, selectPreviewItem } from "@/lib/presentation-workflow"
import { generateHymnScreens } from "@/services/hymnal/generate-hymn-screens"
import {
  createGroupedHymnQueueItems,
  createHymnPresentationItem,
  defaultSelectedSectionIds,
} from "@/services/hymnal/hymn-presentation"
import { addRecentHymn } from "@/services/hymnal/hymnal-history"
import { getHymnByNumber } from "@/services/hymnal/hymnal-repository"
import { getBroadcastLiveStore } from "@/stores/broadcast/live-store"
import { useDetectionStore } from "@/stores/detection-store"
import { useHymnSlideStore } from "@/stores/hymn-slide-store"
import { useQueueStore } from "@/stores/queue-store"
import type {
  DetectionResult,
  Hymn,
  HymnPresentationItemData,
  HymnScreen,
} from "@/types"

const VALID_HYMN_NUMBERS: Set<number> = new Set(SDA_HYMNAL_INDEX.map((hymn) => hymn.number))
const DEDUPE_WINDOW_MS = 5000

const HYMN_CUE_WORD_PATTERN =
  "(?:hymn|hymns|hymnal|hymnals|song|songs|lied|liedere|liedboek|liedboeke)"
const HYMN_COLLECTION_PATTERN =
  "(?:sda|adventist|adventiste|seventh(?:\\s|-)?day\\s+adventist|sewende(?:\\s|-)?dag\\s+adventiste)"
const HYMN_CUE_PATTERN = new RegExp(
  `\\b(?:${HYMN_COLLECTION_PATTERN}\\s+${HYMN_CUE_WORD_PATTERN}|${HYMN_CUE_WORD_PATTERN})(?:\\s+(?:number|nommer))?\\s+([a-z0-9][a-z0-9\\s-]*)`,
  "i"
)

const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  nul: 0,
  een: 1,
  twee: 2,
  drie: 3,
  vier: 4,
  vyf: 5,
  ses: 6,
  sewe: 7,
  agt: 8,
  nege: 9,
  tien: 10,
  elf: 11,
  twaalf: 12,
  dertien: 13,
  veertien: 14,
  vyftien: 15,
  sestien: 16,
  sewentien: 17,
  agtien: 18,
  negentien: 19,
}

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  twintig: 20,
  dertig: 30,
  veertig: 40,
  vyftig: 50,
  sestig: 60,
  sewentig: 70,
  tagtig: 80,
  negentig: 90,
}

const NUMBER_CONNECTORS = new Set(["and", "en"])
const HUNDRED_WORDS = new Set(["hundred", "honderd"])

let lastHandled: { hymnNumber: number; at: number } | null = null

function normalizeTranscript(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isValidHymnNumber(number: number): boolean {
  return Number.isInteger(number) && number > 0 && VALID_HYMN_NUMBERS.has(number)
}

function parseSpokenNumber(words: string[]): number | null {
  let total = 0
  let current = 0

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]
    if (NUMBER_CONNECTORS.has(word)) continue

    if (HUNDRED_WORDS.has(word)) {
      current = (current === 0 ? 1 : current) * 100
      continue
    }

    if (word in TENS) {
      current += TENS[word]
      continue
    }

    if (word in ONES) {
      const ones = ONES[word]
      const next = words[index + 1]
      const afterNext = words[index + 2]
      if (
        next !== undefined &&
        afterNext !== undefined &&
        NUMBER_CONNECTORS.has(next) &&
        afterNext in TENS
      ) {
        current += TENS[afterNext] + ones
        index += 2
        continue
      }
      current += ones
      continue
    }

    return null
  }

  total += current
  return total > 0 ? total : null
}

function parseNumberPhrase(phrase: string): number | null {
  const trimmed = phrase.trim().toLowerCase()
  if (!trimmed) return null

  if (/^\d+$/.test(trimmed)) {
    const digits = Number.parseInt(trimmed, 10)
    return Number.isFinite(digits) && digits > 0 ? digits : null
  }

  const words = trimmed.replace(/-/g, " ").split(/\s+/).filter(Boolean)
  return parseSpokenNumber(words)
}

export function parseHymnCommand(text: string): number | null {
  const normalized = normalizeTranscript(text)
  if (!normalized) return null

  const match = normalized.match(HYMN_CUE_PATTERN)
  if (!match) return null

  const numberPhrase = match[1].split(/[,.!?;]/)[0]?.trim() ?? ""
  const number = parseNumberPhrase(numberPhrase)
  if (number === null || !isValidHymnNumber(number)) return null

  return number
}

export function shouldSuppressDuplicateHymnCommand(hymnNumber: number, now = Date.now()): boolean {
  if (!lastHandled) return false
  if (now - lastHandled.at > DEDUPE_WINDOW_MS) return false
  return lastHandled.hymnNumber === hymnNumber
}

export function resetHymnVoiceControlState(): void {
  lastHandled = null
}

interface LoadedHymn {
  hymn: Hymn
  screens: HymnScreen[]
  deck: HymnPresentationItemData[]
}

async function loadHymn(hymnNumber: number): Promise<LoadedHymn | null> {
  const hymn = await getHymnByNumber(hymnNumber)
  if (!hymn) return null
  const screens = generateHymnScreens({
    hymn,
    selectedSectionIds: defaultSelectedSectionIds(hymn),
  })
  if (screens.length === 0) return null
  const deck = screens.map((screen) => createHymnPresentationItem(screen))
  return { hymn, screens, deck }
}

/** Build the Recent-Detections card payload for a spoken hymn. */
export function createHymnDetection(hymn: Hymn): DetectionResult {
  return {
    content_type: "hymn",
    verse_ref: `Hymn ${hymn.number}`,
    verse_text: hymn.title,
    book_name: "Hymn",
    book_number: 0,
    chapter: 0,
    verse: hymn.number,
    confidence: 1,
    source: "direct",
    auto_queued: false,
    transcript_snippet: "",
    is_chapter_only: false,
    hymn: { number: hymn.number, id: hymn.id, title: hymn.title },
  }
}

export async function handleHymnVoiceControl(text: string): Promise<boolean> {
  const hymnNumber = parseHymnCommand(text)
  if (hymnNumber === null) return false

  if (shouldSuppressDuplicateHymnCommand(hymnNumber)) return false

  const loaded = await loadHymn(hymnNumber)
  if (!loaded) return false

  useHymnSlideStore.getState().setDeck(loaded.deck, 0)
  // Auto-live sends the hymn straight to the live output; otherwise it only
  // stages to preview for the operator to commit.
  if (getBroadcastLiveStore().readingModeAutoLive) {
    presentItem(loaded.deck[0])
  } else {
    selectPreviewItem(loaded.deck[0])
  }
  useDetectionStore.getState().addDetection(createHymnDetection(loaded.hymn))
  addRecentHymn(loaded.hymn.id)
  lastHandled = { hymnNumber, at: Date.now() }
  return true
}

/** Re-preview a hymn from its detection card. */
export async function previewHymnByNumber(hymnNumber: number): Promise<void> {
  const loaded = await loadHymn(hymnNumber)
  if (!loaded) return
  useHymnSlideStore.getState().setDeck(loaded.deck, 0)
  selectPreviewItem(loaded.deck[0])
}

/** Send a hymn live from its detection card. */
export async function presentHymnByNumber(hymnNumber: number): Promise<void> {
  const loaded = await loadHymn(hymnNumber)
  if (!loaded) return
  useHymnSlideStore.getState().setDeck(loaded.deck, 0)
  presentItem(loaded.deck[0])
}

/** Queue a hymn's screens from its detection card. */
export async function queueHymnByNumber(hymnNumber: number): Promise<void> {
  const loaded = await loadHymn(hymnNumber)
  if (!loaded) return
  useQueueStore.getState().addItems(createGroupedHymnQueueItems(loaded.screens))
}
