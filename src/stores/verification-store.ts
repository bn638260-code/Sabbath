import { create } from "zustand"
import {
  clearVerification,
  loadCachedVerification,
  refreshVerification,
  verifyDevice,
} from "@/lib/verification/verification-provider"
import type { VerificationStateSnapshot } from "@/types/verification"

interface VerificationStore extends VerificationStateSnapshot {
  isHydrated: boolean
  hydrate: () => Promise<void>
  verifyDevice: () => Promise<void>
  refresh: () => Promise<void>
  clear: () => Promise<void>
}

let hydrationPromise: Promise<void> | null = null

function applySnapshot(snapshot: VerificationStateSnapshot): void {
  useVerificationStore.setState({ ...snapshot, isHydrated: true })
}

export const useVerificationStore = create<VerificationStore>(() => ({
  status: "checking",
  verifiedUserId: null,
  verifiedDeviceId: null,
  accessTokenExpiresAt: null,
  lastVerifiedAt: null,
  offlineGraceExpiresAt: null,
  error: null,
  isHydrated: false,

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise
    hydrationPromise = (async () => {
      try {
        applySnapshot(await loadCachedVerification())
      } catch (error) {
        useVerificationStore.setState({
          status: "error",
          error: String(error),
          isHydrated: true,
        })
      }
    })()
    return hydrationPromise
  },

  verifyDevice: async () => {
    useVerificationStore.setState({ status: "checking", error: null })
    try {
      applySnapshot(await verifyDevice())
    } catch (error) {
      useVerificationStore.setState({ status: "error", error: String(error), isHydrated: true })
    }
  },

  refresh: async () => {
    useVerificationStore.setState({ status: "checking", error: null })
    try {
      applySnapshot(await refreshVerification())
    } catch (error) {
      useVerificationStore.setState({ status: "error", error: String(error), isHydrated: true })
    }
  },

  clear: async () => {
    useVerificationStore.setState({ status: "checking", error: null })
    applySnapshot(await clearVerification())
  },
}))

export function hydrateVerification(): Promise<void> {
  return useVerificationStore.getState().hydrate()
}

export function isAppVerified(): boolean {
  const status = useVerificationStore.getState().status
  return status === "verified" || status === "grace"
}
