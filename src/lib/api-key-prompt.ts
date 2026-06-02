import { create } from "zustand"

interface ApiKeyPromptState {
  isOpen: boolean
  open: () => void
  setOpen: (isOpen: boolean) => void
}

export const useApiKeyPromptStore = create<ApiKeyPromptState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  setOpen: (isOpen) => set({ isOpen }),
}))

export function openApiKeyPrompt(): void {
  useApiKeyPromptStore.getState().open()
}
