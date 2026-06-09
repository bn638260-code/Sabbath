import { Button } from "@/components/ui/button"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"
import { useTutorialStore } from "@/stores/tutorial-store"
import { GraduationCapIcon, KeyIcon } from "lucide-react"

export function HelpSection() {
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
              <p className="text-sm font-medium">Interactive Tutorial</p>
              <p className="text-xs text-muted-foreground">
                Step-by-step walkthrough of every feature
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              useTutorialStore.getState().startTutorial()
            }}
          >
            <GraduationCapIcon className="mr-1.5 size-3.5" />
            Restart
          </Button>
        </div>

        <div className="glass-panel flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <KeyIcon className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Keyboard Shortcuts</p>
              <p className="text-xs text-muted-foreground">
                Arrow keys navigate the tutorial, Esc to dismiss
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
