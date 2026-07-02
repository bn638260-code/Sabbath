import { create } from "zustand"

// Global open state for the Broadcast settings dialog so the guided tour can
// open it; the Settings > Broadcast section renders the dialog from this.
interface BroadcastSettingsDialogState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useBroadcastSettingsDialogStore =
  create<BroadcastSettingsDialogState>((set) => ({
    open: false,
    setOpen: (open) => set({ open }),
  }))
