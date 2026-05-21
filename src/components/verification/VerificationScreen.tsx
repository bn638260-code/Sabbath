import { ShieldCheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { useVerificationStore } from "@/stores/verification-store"

function formatDate(timestamp: number | null): string {
  return timestamp ? new Date(timestamp).toLocaleString() : "Not available"
}

export function VerificationScreen() {
  const status = useVerificationStore((s) => s.status)
  const error = useVerificationStore((s) => s.error)
  const offlineGraceExpiresAt = useVerificationStore((s) => s.offlineGraceExpiresAt)
  const verifyDevice = useVerificationStore((s) => s.verifyDevice)
  const refresh = useVerificationStore((s) => s.refresh)

  const isChecking = status === "checking"
  const description =
    status === "expired"
      ? "Your local verification session expired. Verify this device again to continue."
      : status === "error"
        ? error ?? "Verification failed closed. Retry when ready."
        : "Verify this device before entering SabbathCue."

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card">
        <PanelEmptyState
          icon={<ShieldCheckIcon className="size-10" />}
          title="Verification required"
          description={description}
        >
          <div className="flex flex-col gap-2">
            <Button disabled={isChecking} onClick={() => void verifyDevice()}>
              {isChecking ? "Checking..." : "Verify this device"}
            </Button>
            <Button disabled={isChecking} variant="outline" onClick={() => void refresh()}>
              Retry verification
            </Button>
            {offlineGraceExpiresAt && (
              <p className="text-xs text-muted-foreground">
                Offline grace expires: {formatDate(offlineGraceExpiresAt)}
              </p>
            )}
            <p className="max-w-xs text-xs text-muted-foreground">
              Current build uses a local mock verifier. Hosted account verification can replace it
              without changing this screen.
            </p>
          </div>
        </PanelEmptyState>
      </div>
    </div>
  )
}
