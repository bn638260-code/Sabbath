"use client";

import { useEffect, useState } from "react";
import { Button } from "../_components/ui/button";
import { getSupabaseClient } from "../_lib/supabase-client";

type Phase = "loading" | "ready" | "done" | "invalid";

export function ResetPasswordForm() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPhase("ready");
      }
    });

    let cancelled = false;

    async function bootstrapRecoverySession() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

      const tokenHash = params.get("token_hash") ?? hashParams.get("token_hash");
      const type = params.get("type") ?? hashParams.get("type");

      if (tokenHash && type === "recovery") {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });
        if (!cancelled && !verifyError) {
          setPhase("ready");
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled && session) {
        setPhase("ready");
        return;
      }

      window.setTimeout(() => {
        if (cancelled) return;
        void supabase.auth.getSession().then(({ data: { session: retrySession } }) => {
          if (!cancelled) {
            setPhase(retrySession ? "ready" : "invalid");
          }
        });
      }, 1500);
    }

    void bootstrapRecoverySession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    const supabase = getSupabaseClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      // Keep the recovery session alive so the user can correct and retry.
      setBusy(false);
      setError(updateError.message);
      return;
    }

    await supabase.auth.signOut();
    setBusy(false);
    setPhase("done");
  }

  if (phase === "loading") {
    return (
      <p className="text-sm text-muted-foreground">Confirming your reset link…</p>
    );
  }

  if (phase === "invalid") {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          This reset link is invalid or has expired. Request a new one from the SabbathCue app
          (Forgot password?) and open the latest email.
        </p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-3 text-sm">
        <p className="font-medium text-foreground">Password updated</p>
        <p className="text-muted-foreground">
          Return to SabbathCue and sign in with your new password.
        </p>
      </div>
    );
  }

  return (
    <form className="flex w-full max-w-sm flex-col gap-3" onSubmit={(event) => void handleSubmit(event)}>
      <p className="text-sm text-muted-foreground">
        Choose a new password for your SabbathCue account.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">New password</span>
        <input
          autoComplete="new-password"
          className="rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          disabled={busy}
          minLength={6}
          required
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Confirm password</span>
        <input
          autoComplete="new-password"
          className="rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          disabled={busy}
          minLength={6}
          required
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <Button disabled={busy} type="submit">
        {busy ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
