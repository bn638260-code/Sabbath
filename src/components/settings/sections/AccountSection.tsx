import { useCallback, useEffect, useState } from "react"
import {
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
  adminSetSuspended,
  deleteOwnAccount,
  fetchIsAdmin,
  type AdminAccountRow,
} from "@/lib/supabase/account"
import { useVerificationStore } from "@/stores/verification-store"

function formatTimestamp(value: string | null): string {
  if (!value) return "never"
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "unknown" : parsed.toLocaleString()
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
          : `Suspended ${account.email ?? account.user_id}`,
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
          <p className="text-sm font-medium">Admin · Accounts</p>
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void refresh()}>
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
                        <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                          Admin
                        </span>
                      ) : null}
                      {account.suspended ? (
                        <span className="ml-2 rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-destructive">
                          Suspended
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.device_count} device{account.device_count === 1 ? "" : "s"} ·
                      last seen {formatTimestamp(account.last_seen_at)}
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
                    <div className="flex shrink-0 items-center gap-2">
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
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchIsAdmin().then((result) => {
      if (!cancelled) setIsAdmin(result)
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

  return (
    <div className="space-y-6">
      <div className="glass-panel flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <UserIcon className="size-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{verifiedEmail ?? "Signed in"}</p>
            <p className="text-xs text-muted-foreground">SabbathCue account</p>
          </div>
        </div>
        <Button variant="outline" size="sm" disabled={deleting} onClick={() => void signOut()}>
          <LogOutIcon className="mr-1.5 size-3.5" />
          Sign out
        </Button>
      </div>

      <div className="glass-panel space-y-3 p-4">
        <div>
          <p className="text-sm font-medium">Delete account</p>
          <p className="text-xs text-muted-foreground">
            Permanently removes your account and all registered devices. This cannot be undone.
          </p>
        </div>
        {confirmingDelete ? (
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
          <Button variant="outline" size="sm" onClick={() => setConfirmingDelete(true)}>
            <Trash2Icon className="mr-1.5 size-3.5 text-destructive" />
            Delete account
          </Button>
        )}
      </div>

      {isAdmin ? <AdminAccountsPanel /> : null}
    </div>
  )
}
