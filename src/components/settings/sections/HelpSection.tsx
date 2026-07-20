import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"
import { openSupportEmail } from "@/lib/support-contact"
import { useAppUpdate } from "@/hooks/use-app-update"
import { isTauriRuntime } from "@/lib/tauri-runtime"
import { useTutorialStore } from "@/stores/tutorial-store"
import {
  GraduationCapIcon,
  KeyIcon,
  MailIcon,
  RefreshCwIcon,
} from "lucide-react"
import { toast } from "sonner"
import { fetchIsAdmin } from "@/lib/supabase/account"
import {
  DASHBOARD_KEYBOARD_SHORTCUTS,
  getPrimaryShortcutModifier,
  getShortcutDisplayParts,
} from "@/lib/dashboard-keyboard-shortcuts"

export function HelpSection() {
  const { state, loadVersion, check } = useAppUpdate()
  const [checkingManual, setCheckingManual] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const primaryModifier = getPrimaryShortcutModifier()

  useEffect(() => {
    if (!isTauriRuntime()) return
    void loadVersion()
  }, [loadVersion])

  useEffect(() => {
    let cancelled = false
    void fetchIsAdmin().then((admin) => {
      if (!cancelled) setIsAdmin(admin)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleCheckForUpdates() {
    setCheckingManual(true)
    const result = await check()
    setCheckingManual(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    if (result.available) {
      toast.info(`Update ${result.update?.version ?? ""} is available.`, {
        description:
          "Restart the app from the update prompt when you are ready.",
      })
      return
    }

    toast.success("You are on the latest version.")
  }
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Resources to help you get the most out of {APP_DISPLAY_NAME}.
        </p>
      </div>

      <div className="space-y-3">
        <div className="glass-panel flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <GraduationCapIcon className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Interactive training</p>
              <p className="text-xs text-muted-foreground">
                Guided operator tasks and pilot administration
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                useTutorialStore.getState().startTutorial("operator")
              }}
            >
              <GraduationCapIcon className="mr-1.5 size-3.5" />
              Operator training
            </Button>
            {isAdmin ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  useTutorialStore.getState().startTutorial("admin")
                }}
              >
                <GraduationCapIcon className="mr-1.5 size-3.5" />
                Admin training
              </Button>
            ) : null}
          </div>
        </div>

        <div className="glass-panel flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <MailIcon className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Contact developer</p>
              <p className="text-xs text-muted-foreground">
                Ask about pilot access or send a support request
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void openSupportEmail()}
          >
            <MailIcon className="mr-1.5 size-3.5" />
            Contact
          </Button>
        </div>

        <div className="glass-panel flex items-center justify-between p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--shell-bg-sunken)]">
              <KeyIcon className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Keyboard Shortcuts</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Dashboard commands use {primaryModifier} on this device.
              </p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {DASHBOARD_KEYBOARD_SHORTCUTS.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <p className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                      {group.title}
                    </p>
                    <div className="space-y-1.5">
                      {group.shortcuts.map((shortcut) => (
                        <div
                          key={`${group.title}-${shortcut.keys}`}
                          className="grid grid-cols-[minmax(120px,auto)_1fr] items-start gap-3 text-xs"
                        >
                          <span className="flex min-w-0 flex-wrap items-center gap-1">
                            {getShortcutDisplayParts(shortcut.keys).map(
                              (part, index, parts) => (
                                <span
                                  key={`${shortcut.keys}-${part}-${index}`}
                                  className="flex items-center gap-1"
                                >
                                  <kbd className="rounded border border-[var(--border-dim)] bg-[var(--shell-bg-sunken)] px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                                    {part}
                                  </kbd>
                                  {index < parts.length - 1 ? (
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                      +
                                    </span>
                                  ) : null}
                                </span>
                              )
                            )}
                          </span>
                          <span className="leading-relaxed text-muted-foreground">
                            {shortcut.action}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {isTauriRuntime() ? (
          <div className="glass-panel flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium">App version</p>
              <p className="text-xs text-muted-foreground">
                {state.currentVersion
                  ? `v${state.currentVersion}`
                  : "Loading version..."}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={checkingManual || state.phase === "checking"}
              onClick={() => void handleCheckForUpdates()}
            >
              <RefreshCwIcon className="mr-1.5 size-3.5" />
              Check for updates
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
