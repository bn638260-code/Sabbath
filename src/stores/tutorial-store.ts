import { create } from "zustand"
import { load } from "@tauri-apps/plugin-store"
import { isTauriRuntime } from "@/lib/tauri-runtime"
import { useSettingsStore } from "./settings-store"

const BROWSER_ONBOARDING_COMPLETE_KEY = "sabbathcue.onboardingComplete"

export type TutorialMode = "operator" | "admin" | "all"

interface TutorialState {
  isRunning: boolean
  mode: TutorialMode
  startTutorial: (mode?: TutorialMode) => void
  stopTutorial: () => void
}

export const useTutorialStore = create<TutorialState>((set) => ({
  isRunning: false,
  mode: "operator",
  startTutorial: (mode = "operator") => set({ isRunning: true, mode }),
  stopTutorial: () => set({ isRunning: false }),
}))

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getBrowserOnboardingComplete(): boolean {
  try {
    return (
      getBrowserStorage()?.getItem(BROWSER_ONBOARDING_COMPLETE_KEY) === "true"
    )
  } catch {
    return false
  }
}

function setBrowserOnboardingComplete(): void {
  try {
    getBrowserStorage()?.setItem(BROWSER_ONBOARDING_COMPLETE_KEY, "true")
  } catch {
    // Browser dev can still mark the in-memory session complete.
  }
}

/** Load onboardingComplete from disk into settings store. */
export async function hydrateOnboardingState(): Promise<void> {
  if (!isTauriRuntime()) {
    if (getBrowserOnboardingComplete()) {
      useSettingsStore.getState().setOnboardingComplete(true)
    }
    return
  }

  try {
    const store = await load("settings.json", { autoSave: false, defaults: {} })
    const completed = await store.get<boolean>("onboardingComplete")
    if (completed) {
      useSettingsStore.getState().setOnboardingComplete(true)
    }
  } catch {
    console.warn("[tutorial] Failed to load persisted state, using defaults")
  }
}

/** Write onboardingComplete=true to both Zustand and disk. */
export async function persistOnboardingComplete(): Promise<void> {
  useSettingsStore.getState().setOnboardingComplete(true)
  if (!isTauriRuntime()) {
    setBrowserOnboardingComplete()
    return
  }

  try {
    const store = await load("settings.json", { autoSave: false, defaults: {} })
    await store.set("onboardingComplete", true)
    await store.save()
  } catch {
    console.warn("[tutorial] Failed to persist onboarding state")
  }
}
