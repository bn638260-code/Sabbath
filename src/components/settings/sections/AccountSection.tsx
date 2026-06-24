import { useCallback, useEffect, useState } from "react"
import {
  BanIcon,
  CalendarPlusIcon,
  LogOutIcon,
  RefreshCwIcon,
  ShieldIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  adminDeleteAccount,
  adminListAccounts,
  adminSetAccess,
  adminSetSuspended,
  deleteOwnAccount,
  fetchIsAdmin,
  requestAccountCancellation,
  type AdminAccountRow,
} from "@/lib/supabase/account"
import {
  buildCancellationEmailOptions,
  openSupportEmail,
} from "@/lib/support-contact"
import { useVerificationStore } from "@/stores/verification-store"
import { AnnouncementsAdminPanel } from "@/components/settings/sections/AnnouncementsAdminPanel"

const ACCESS_EXTENSION_OPTIONS = [
  { days: 30, label: "Extend 30 days", toastLabel: "30 days" },
  { days: 365, label: "Extend 1 year", toastLabel: "1 year" },
] as const

function formatTimestamp(value: string | null): string {
  if (!value) return "never"
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "unknown" : parsed.toLocaleString()
}

function formatAccessExpiry(value: string | null, isAdmin: boolean): string {
  if (isAdmin) return "admin exempt"
  if (!value) return "not active"

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "unknown"

  return parsed.getTime() <= Date.now()
    ? `ended ${parsed.toLocaleString()}`
    : `until ${parsed.toLocaleString()}`
}

function AdminAccountsPanel() {
  const currentUserId = useVerificationStore((s) => s.verifiedUserId)
  const [accounts, setAccounts] = useState<AdminAccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const [reloadCount, setReloadCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    void adminListAccounts().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setAccounts(result.accounts)
        setLoadError(null)
      } else {
        setLoadError(result.message)
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [reloadCount])

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setReloadCount((count) => count + 1)
  }, [])

  async function handleSuspendToggle(account: AdminAccountRow) {
    setBusyUserId(account.user_id)
    const result = await adminSetSuspended(account.user_id, !account.suspended)
    setBusyUserId(null)
    if (result.ok) {
      toast.success(
        account.suspended
          ? `Reinstated ${account.email ?? account.user_id}`
          : `Suspended ${account.email ?? account.user_id}`
      )
      await refresh()
    } else {
      toast.error(result.message)
    }
  }

  async function handleExtendAccess(
    account: AdminAccountRow,
    option: (typeof ACCESS_EXTENSION_OPTIONS)[number]
  ) {
    setBusyUserId(account.user_id)
    const result = await adminSetAccess(account.user_id, option.days)
    setBusyUserId(null)
    if (result.ok) {
      toast.success(
        `Extended ${account.email ?? account.user_id} for ${option.toastLabel}`
      )
      await refresh()
    } else {
      toast.error(result.message)
    }
  }

  async function handleDelete(account: AdminAccountRow) {
    setBusyUserId(account.user_id)
    const result = await adminDeleteAccount(account.user_id)
    setBusyUserId(null)
    setPendingDeleteId(null)
    if (result.ok) {
      toast.success(`Deleted ${account.email ?? account.user_id}`)
      await refresh()
    } else {
      toast.error(result.message)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldIcon className="size-4 text-primary" />
          <p className="text-sm font-medium">Admin - Accounts</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCwIcon className="mr-1.5 size-3.5" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading accounts...</p>
      ) : loadError ? (
        <p className="text-xs text-destructive">{loadError}</p>
      ) : accounts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No accounts found.</p>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => {
            const isSelf = account.user_id === currentUserId
            const isBusy = busyUserId === account.user_id
            const confirmingDelete = pendingDeleteId === account.user_id
            return (
              <div key={account.user_id} className="glass-panel space-y-2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {account.email ?? account.user_id}
                      {account.is_admin ? (
                        <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] tracking-wide text-primary uppercase">
                          Admin
                        </span>
                      ) : null}
                      {account.suspended ? (
                        <span className="ml-2 rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] tracking-wide text-destructive uppercase">
                          Suspended
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.device_count} device
                      {account.device_count === 1 ? "" : "s"} - last seen{" "}
                      {formatTimestamp(account.last_seen_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Access{" "}
                      {formatAccessExpiry(
                        account.access_expires_at,
                        account.is_admin
                      )}
                    </p>
                  </div>
                  {account.is_admin ? null : confirmingDelete ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => void handleDelete(account)}
                      >
                        Confirm delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => setPendingDeleteId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {ACCESS_EXTENSION_OPTIONS.map((option) => (
                        <Button
                          key={option.days}
                          variant="outline"
                          size="sm"
                          disabled={isBusy || isSelf}
                          onClick={() =>
                            void handleExtendAccess(account, option)
                          }
                        >
                          <CalendarPlusIcon className="mr-1.5 size-3.5" />
                          {option.label}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy || isSelf}
                        onClick={() => void handleSuspendToggle(account)}
                      >
                        {account.suspended ? "Reinstate" : "Suspend"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isBusy || isSelf}
                        title={`Delete ${account.email ?? "account"}`}
                        aria-label={`Delete ${account.email ?? "account"}`}
                        onClick={() => setPendingDeleteId(account.user_id)}
                      >
                        <Trash2Icon className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AccountSection() {
  const verifiedEmail = useVerificationStore((s) => s.verifiedEmail)
  const signOut = useVerificationStore((s) => s.signOut)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [confirmingCancellation, setConfirmingCancellation] = useState(false)
  const [requestingCancellation, setRequestingCancellation] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchIsAdmin().then((result) => {
      if (cancelled) return
      setIsAdmin(result)
      setCheckingAdmin(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleDeleteAccount() {
    setDeleting(true)
    const result = await deleteOwnAccount()
    if (result.ok) {
      toast.success("Your account has been deleted.")
      await signOut()
    } else {
      setDeleting(false)
      setConfirmingDelete(false)
      toast.error(result.message)
    }
  }

  async function handleRequestCancellation() {
    setRequestingCancellation(true)
    const result = await requestAccountCancellation(verifiedEmail)
    try {
      await openSupportEmail(
        buildCancellationEmailOptions({ accountEmail: verifiedEmail })
      )
      toast.success(
        result.ok
          ? "Cancellation request saved. Email opened for your records."
          : "Cancellation email opened. Backend request could not be saved."
      )
      setConfirmingCancellation(false)
    } catch {
      toast.error(
        result.ok
          ? "Cancellation request saved. Could not open your email app."
          : "Could not save the request or open your email app. Contact support manually."
      )
    } finally {
      setRequestingCancellation(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <UserIcon className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {verifiedEmail ?? "Signed in"}
            </p>
            <p className="text-xs text-muted-foreground">SabbathCue account</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={deleting}
          onClick={() => void signOut()}
        >
          <LogOutIcon className="mr-1.5 size-3.5" />
          Sign out
        </Button>
      </div>

      <div className="glass-panel space-y-3 p-4">
        <div>
          <p className="text-sm font-medium">Cancel subscription</p>
          <p className="text-xs text-muted-foreground">
            Request cancellation of renewal/access. The request is saved to
            your account and does not delete your service history.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Cancellation disclaimer</p>
          <p className="mt-1">
            No refunds are issued for the current paid period. Your app access
            remains active until the subscribed period ends; after that,
            SabbathCue access is disabled unless renewed.
          </p>
        </div>
        {confirmingCancellation ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={requestingCancellation}
              onClick={() => void handleRequestCancellation()}
            >
              {requestingCancellation
                ? "Opening email..."
                : "Send cancellation request"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={requestingCancellation}
              onClick={() => setConfirmingCancellation(false)}
            >
              Keep subscription
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmingCancellation(true)}
          >
            <BanIcon className="mr-1.5 size-3.5" />
            Request cancellation
          </Button>
        )}
      </div>

      <div className="glass-panel space-y-3 p-4">
        <div>
          <p className="text-sm font-medium">Delete account</p>
          <p className="text-xs text-muted-foreground">
            Permanently removes your account and all registered devices. This
            cannot be undone.
          </p>
        </div>
        {isAdmin ? (
          <p className="text-xs text-muted-foreground">
            Admin accounts are protected from self-delete. Remove the admin row
            in Supabase first if this account must be deleted.
          </p>
        ) : confirmingDelete ? (
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={() => void handleDeleteAccount()}
            >
              {deleting ? "Deleting..." : "Yes, permanently delete"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={deleting}
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={checkingAdmin}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2Icon className="mr-1.5 size-3.5 text-destructive" />
            {checkingAdmin ? "Checking account..." : "Delete account"}
          </Button>
        )}
      </div>

      {isAdmin ? (
        <>
          <AdminAccountsPanel />
          <AnnouncementsAdminPanel />
        </>
      ) : null}
    </div>
  )
}
