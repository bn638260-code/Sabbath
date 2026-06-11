import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";
import { SITE } from "../_lib/site";

export const metadata: Metadata = {
  title: "Reset password",
  description: `Reset your ${SITE.name} account password.`,
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
        <div className="mt-6">
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
