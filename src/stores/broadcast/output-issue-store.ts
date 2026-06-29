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

export const useBroadcastOutputIssueStore =
  useBroadcastStore as unknown as BroadcastOutputIssueHook

export function getBroadcastOutputIssueStore(): BroadcastOutputIssueState {
  return useBroadcastOutputIssueStore.getState()
}

export { selectLatestOutputIssue }
