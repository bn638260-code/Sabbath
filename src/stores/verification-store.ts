import { create } from "zustand"
import {
  clearVerification,
  heartbeatDeviceRegistration,
  loadCachedVerification,
  refreshVerification,
  signIn as providerSignIn,
  signOut as providerSignOut,
  signUp as providerSignUp,
} from "@/lib/verification/verification-provider"
import type { VerificationStateSnapshot } from "@/types/verification"

const HEARTBEAT_MS = 6 * 60 * 60 * 1000

interface VerificationStore extends VerificationStateSnapshot {
  isHydrated: boolean
  hydrate: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  clear: () => Promise<void>
}

let hydrationPromise: Promise<void> | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

function stopHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

function startHeartbeat(): void {
  stopHeartbeat()
  heartbeatTimer = setInterval(() => {
    void (async () => {
      const snapshot = await heartbeatDeviceRegistration()
      if (snapshot) applySnapshot(snapshot)
    })().catch(() => {
      // Transient heartbeat failures never kick an active session.
    })
  }, HEARTBEAT_MS)
}

function applySnapshot(snapshot: VerificationStateSnapshot): void {
  if (snapshot.status === "verified") {
    startHeartbeat()
  } else {
    stopHeartbeat()
  }

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
  errorCode: null,
  isHydrated: false,

  hydrate: async () => {
    if (hydrationPromise) return hydrationPromise
    hydrationPromise = (async () => {
      try {
        applySnapshot(await loadCachedVerification())
      } catch (error) {
        stopHeartbeat()
        useVerificationStore.setState({
          status: "error",
          error: String(error),
          errorCode: "unknown",
          isHydrated: true,
        })
      }
    })()
    return hydrationPromise
  },

  signIn: async (email, password) => {
    useVerificationStore.setState({ status: "checking", error: null, errorCode: null })
    try {
      applySnapshot(await providerSignIn(email, password))
    } catch (error) {
      stopHeartbeat()
      useVerificationStore.setState({
        status: "error",
        error: String(error),
        errorCode: "unknown",
        isHydrated: true,
      })
    }
  },

  signUp: async (email, password) => {
    useVerificationStore.setState({ status: "checking", error: null, errorCode: null })
    try {
      applySnapshot(await providerSignUp(email, password))
    } catch (error) {
      stopHeartbeat()
      useVerificationStore.setState({
        status: "error",
        error: String(error),
        errorCode: "unknown",
        isHydrated: true,
      })
    }
  },

  signOut: async () => {
    useVerificationStore.setState({ status: "checking", error: null, errorCode: null })
    stopHeartbeat()
    applySnapshot(await providerSignOut())
  },

  refresh: async () => {
    useVerificationStore.setState({ status: "checking", error: null, errorCode: null })
    try {
      applySnapshot(await refreshVerification())
    } catch (error) {
      stopHeartbeat()
      useVerificationStore.setState({
        status: "error",
        error: String(error),
        errorCode: "unknown",
        isHydrated: true,
      })
    }
  },

  clear: async () => {
    useVerificationStore.setState({ status: "checking", error: null, errorCode: null })
    stopHeartbeat()
    applySnapshot(await clearVerification())
  },
}))

export function hydrateVerification(): Promise<void> {
  return useVerificationStore.getState().hydrate()
}

export function isAppVerified(): boolean {
  return useVerificationStore.getState().status === "verified"
}

/** Test-only: reset hydration promise and heartbeat between cases. */
export function resetVerificationStoreForTests(): void {
  hydrationPromise = null
  stopHeartbeat()
}
