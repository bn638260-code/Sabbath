import type { ReactNode } from "react"
import { VerificationScreen } from "@/components/verification/VerificationScreen"
import { useVerificationStore } from "@/stores/verification-store"

export function VerificationGate({ children }: { children: ReactNode }) {
  const status = useVerificationStore((s) => s.status)
  const isHydrated = useVerificationStore((s) => s.isHydrated)

  if (!isHydrated || status === "checking") {
    return <VerificationScreen />
  }

  if (status !== "verified" && status !== "grace") {
    return <VerificationScreen />
  }

  return children
}
