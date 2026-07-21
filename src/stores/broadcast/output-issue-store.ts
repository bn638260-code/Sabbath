import {
  selectLatestOutputIssue,
  useBroadcastStore,
  type BroadcastState,
} from "@/stores/broadcast-store"

export type BroadcastOutputIssueState = Pick<
  BroadcastState,
  | "outputIssues"
  | "reportOutputIssue"
  | "clearOutputIssue"
  | "clearOutputIssueFor"
  | "clearOutputIssuesFor"
>

type BroadcastOutputIssueHook = {
  <T>(selector: (state: BroadcastOutputIssueState) => T): T
  getState: () => BroadcastOutputIssueState
}

// `useBroadcastStore` is referenced lazily (inside these closures) instead of
// being captured at module-init time. output-issue-store sits inside a circular
// import chain — broadcast-store → live-slice → action-notifications →
// settings-store → output-issue-store → broadcast-store — so this module can be
// evaluated while broadcast-store is still initializing, at which point the
// imported `useBroadcastStore` binding is briefly `undefined`. Capturing it
// eagerly here would freeze that `undefined`; deferring the read to call time
// resolves the fully-initialized store instead.
export const useBroadcastOutputIssueStore = Object.assign(
  <T>(selector: (state: BroadcastOutputIssueState) => T): T =>
    (useBroadcastStore as unknown as BroadcastOutputIssueHook)(selector),
  {
    getState: (): BroadcastOutputIssueState => useBroadcastStore.getState(),
  }
) as unknown as BroadcastOutputIssueHook

export function getBroadcastOutputIssueStore(): BroadcastOutputIssueState {
  return useBroadcastOutputIssueStore.getState()
}

export { selectLatestOutputIssue }
