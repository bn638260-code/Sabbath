import { useState } from "react"
import { KeyRoundIcon, ShieldCheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PanelEmptyState } from "@/components/ui/panel-empty-state"
import { requestPasswordReset } from "@/lib/supabase/auth"
import { useVerificationStore } from "@/stores/verification-store"
import type { VerificationErrorCode } from "@/types/verification"

function errorMessage(
  errorCode: VerificationErrorCode | null,
  error: string | null,
): string {
  switch (errorCode) {
    case "invalid_credentials":
      return "Email or password is incorrect."
    case "email_not_confirmed":
      return "Confirm your email address before signing in."
    case "device_limit_reached":
      return (
        error ??
        "This account is already registered on the maximum number of devices (2)."
      )
    case "suspended":
      return error ?? "This account has been suspended. Contact support for assistance."
    case "network":
      return "Unable to connect. Check your network and try again."
    default:
      return error ?? "Sign in failed. Try again when ready."
  }
}

function PasswordResetForm({
  initialEmail,
  onDone,
}: {
  initialEmail: string
  onDone: (notice: string | null) => void
}) {
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSendLink() {
    setBusy(true)
    setError(null)
    const result = await requestPasswordReset(email.trim())
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSent(true)
  }

  const description =
    error ??
    (sent
      ? `We sent a reset link to ${email.trim()}. Open it in your browser, choose a new password, then return here and sign in.`
      : "Enter your account email and we'll send a reset link you can open in your browser.")

  return (
    <PanelEmptyState
      icon={<KeyRoundIcon className="size-10" />}
      title="Reset password"
      description={description}
    >
      <div className="flex w-full max-w-xs flex-col gap-3">
        {!sent ? (
          <>
            <Input
              autoComplete="email"
              disabled={busy}
              placeholder="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button disabled={busy || !email.trim()} onClick={() => void handleSendLink()}>
              {busy ? "Sending..." : "Send reset link"}
            </Button>
          </>
        ) : (
          <Button disabled={busy} variant="outline" onClick={() => void handleSendLink()}>
            {busy ? "Sending..." : "Resend link"}
          </Button>
        )}
        <Button disabled={busy} variant="ghost" onClick={() => onDone(null)}>
          Back to sign in
        </Button>
      </div>
    </PanelEmptyState>
  )
}

export function VerificationScreen() {
  const status = useVerificationStore((s) => s.status)
  const error = useVerificationStore((s) => s.error)
  const errorCode = useVerificationStore((s) => s.errorCode)
  const signIn = useVerificationStore((s) => s.signIn)
  const signUp = useVerificationStore((s) => s.signUp)
  const signOut = useVerificationStore((s) => s.signOut)
  const refresh = useVerificationStore((s) => s.refresh)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showReset, setShowReset] = useState(false)
  const [resetNotice, setResetNotice] = useState<string | null>(null)

  const isChecking = status === "checking"
  const showStaleSessionActions = status === "expired"

  const title =
    status === "expired"
      ? "Session expired"
      : status === "error"
        ? "Sign in required"
        : "Sign in to SabbathCue"

  const description =
    resetNotice ??
    (status === "checking"
      ? "Checking your account..."
      : status === "expired"
        ? "Your saved session is no longer valid. Sign in again or clear the stale session."
        : status === "error" || status === "required"
          ? errorMessage(errorCode, error)
          : "Sign in with your SabbathCue account to continue.")

  async function handleSignIn() {
    setResetNotice(null)
    await signIn(email.trim(), password)
  }

  async function handleSignUp() {
    setResetNotice(null)
    await signUp(email.trim(), password)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border border-border bg-card">
        {showReset ? (
          <PasswordResetForm
            initialEmail={email.trim()}
            onDone={(notice) => {
              setResetNotice(notice)
              if (notice) setPassword("")
              setShowReset(false)
            }}
          />
        ) : (
          <PanelEmptyState
            icon={<ShieldCheckIcon className="size-10" />}
            title={title}
            description={description}
          >
            <div className="flex w-full max-w-xs flex-col gap-3">
              <Input
                autoComplete="email"
                disabled={isChecking}
                placeholder="Email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Input
                autoComplete="current-password"
                disabled={isChecking}
                placeholder="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Button disabled={isChecking || !email || !password} onClick={() => void handleSignIn()}>
                {isChecking ? "Signing in..." : "Sign in"}
              </Button>
              <Button
                disabled={isChecking || !email || !password}
                variant="outline"
                onClick={() => void handleSignUp()}
              >
                {isChecking ? "Working..." : "Create account"}
              </Button>
              <Button
                disabled={isChecking}
                variant="ghost"
                onClick={() => {
                  setResetNotice(null)
                  setShowReset(true)
                }}
              >
                Forgot password?
              </Button>
              {(status === "error" && errorCode === "network") || showStaleSessionActions ? (
                <Button disabled={isChecking} variant="ghost" onClick={() => void refresh()}>
                  Retry
                </Button>
              ) : null}
              {showStaleSessionActions ? (
                <Button disabled={isChecking} variant="ghost" onClick={() => void signOut()}>
                  Clear stale session
                </Button>
              ) : null}
            </div>
          </PanelEmptyState>
        )}
      </div>
    </div>
  )
}
