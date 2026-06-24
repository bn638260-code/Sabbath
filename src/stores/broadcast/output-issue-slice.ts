import { type StateCreator } from "zustand"
import { toast } from "sonner"
import type {
  BroadcastIssueOutputId,
  BroadcastOutputIssue,
  BroadcastOutputIssueKind,
} from "@/types"
import type { BroadcastState } from "@/stores/broadcast-store"

const OUTPUT_ISSUE_LIMIT = 20
const OUTPUT_ISSUE_TTL_MS = 10 * 60 * 1000

export function selectLatestOutputIssue(
  state: Pick<BroadcastState, "outputIssues">
): BroadcastOutputIssue | null {
  if (state.outputIssues.length === 0) return null
  return state.outputIssues.reduce((latest, issue) =>
    issue.lastSeenAt > latest.lastSeenAt ? issue : latest
  )
}

function dismissOutputIssueToast(id: string): void {
  try {
    toast.dismiss(id)
  } catch {
    // Sonner uses browser animation APIs that are absent in some unit-test runtimes.
  }
}

function pruneOutputIssues(
  issues: BroadcastOutputIssue[],
  now = Date.now()
): BroadcastOutputIssue[] {
  return issues
    .filter((issue) => now - issue.lastSeenAt <= OUTPUT_ISSUE_TTL_MS)
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    .slice(0, OUTPUT_ISSUE_LIMIT)
}

export interface OutputIssueSlice {
  outputIssues: BroadcastOutputIssue[]
  reportOutputIssue: (input: {
    outputId: BroadcastIssueOutputId
    kind: BroadcastOutputIssueKind
    title: string
    description: string
    id?: string
  }) => void
  clearOutputIssue: (id: string) => void
  clearOutputIssueFor: (
    outputId: BroadcastIssueOutputId,
    kind: BroadcastOutputIssueKind
  ) => void
  clearOutputIssuesFor: (outputId: BroadcastIssueOutputId) => void
}

export const createOutputIssueSlice: StateCreator<
  BroadcastState,
  [],
  [],
  OutputIssueSlice
> = (set, get) => ({
  outputIssues: [],
  reportOutputIssue: (input) => {
    const id = input.id ?? `${input.outputId}:${input.kind}`
    const now = Date.now()
    const existing = get().outputIssues.find((issue) => issue.id === id)

    if (existing) {
      set({
        outputIssues: pruneOutputIssues(
          get().outputIssues.map((issue) =>
            issue.id === id
              ? {
                  ...issue,
                  title: input.title,
                  description: input.description,
                  lastSeenAt: now,
                  count: issue.count + 1,
                }
              : issue
          ),
          now
        ),
      })
      return
    }

    const issue: BroadcastOutputIssue = {
      id,
      outputId: input.outputId,
      kind: input.kind,
      title: input.title,
      description: input.description,
      firstSeenAt: now,
      lastSeenAt: now,
      count: 1,
    }
    set({
      outputIssues: pruneOutputIssues([...get().outputIssues, issue], now),
    })
    toast.error(issue.title, {
      id,
      description: issue.description,
    })
  },
  clearOutputIssue: (id) => {
    set({ outputIssues: get().outputIssues.filter((issue) => issue.id !== id) })
    dismissOutputIssueToast(id)
  },
  clearOutputIssueFor: (outputId, kind) => {
    const id = `${outputId}:${kind}`
    set({ outputIssues: get().outputIssues.filter((issue) => issue.id !== id) })
    dismissOutputIssueToast(id)
  },
  clearOutputIssuesFor: (outputId) => {
    const removed = get().outputIssues.filter(
      (issue) => issue.outputId === outputId
    )
    set({
      outputIssues: get().outputIssues.filter(
        (issue) => issue.outputId !== outputId
      ),
    })
    for (const issue of removed) {
      dismissOutputIssueToast(issue.id)
    }
  },
})
