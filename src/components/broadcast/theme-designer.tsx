import { useEffect } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { useBroadcastDesignerStore as useBroadcastStore } from "@/stores/broadcast/designer-store"
import { useBroadcastThemeStore } from "@/stores/broadcast/theme-store"
import { Button } from "@/components/ui/button"
import { SaveIcon, TrashIcon, XIcon } from "lucide-react"
import { ThemeLibrary } from "@/components/broadcast/theme-library"
import { DesignCanvas } from "@/components/broadcast/design-canvas"
import { PropertiesPanel } from "@/components/broadcast/properties-panel"

export function ThemeDesigner() {
  const isDesignerOpen = useBroadcastStore((s) => s.isDesignerOpen)
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const themes = useBroadcastThemeStore((s) => s.themes)

  // Auto-start editing the first theme when opened if nothing is being edited
  useEffect(() => {
    if (isDesignerOpen && !draftTheme && themes.length > 0) {
      useBroadcastStore.getState().startEditing(themes[0].id)
    }
  }, [isDesignerOpen, draftTheme, themes])

  const handleDiscard = () => {
    useBroadcastStore.getState().discardDraft()
  }

  const handleSave = () => {
    useBroadcastStore.getState().saveDraft()
  }

  const handleClose = () => {
    useBroadcastStore.getState().setDesignerOpen(false)
  }

  return (
    <DialogPrimitive.Root
      open={isDesignerOpen}
      onOpenChange={(open) =>
        useBroadcastStore.getState().setDesignerOpen(open)
      }
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="dialog-overlay"
          className="fixed inset-0 z-50 bg-[var(--shell-overlay)] backdrop-blur-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        />

        <DialogPrimitive.Content
          data-slot="theme-designer-content"
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background text-foreground outline-none dark:bg-[var(--bg-deep)]"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            Theme Designer
          </DialogPrimitive.Title>

          {/* Top bar */}
          <div className="controller-headboard flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] px-5">
            <span className="font-serif text-lg tracking-wide text-foreground">
              Theme Designer
            </span>

            <div className="flex-1" />

            <Button variant="outline" onClick={handleDiscard}>
              <TrashIcon className="size-4" />
              Discard
            </Button>
            <Button

              className="bg-primary text-primary-foreground hover:bg-primary/80"
              onClick={handleSave}
            >
              <SaveIcon className="size-4" />
              Save Theme
            </Button>
            <Button
              variant="ghost"
              onClick={handleClose}
            >
              <XIcon strokeWidth={2} />
              Close
            </Button>
          </div>

          {/* 3-panel layout */}
          <div
            className="min-h-0 flex-1"
            style={{
              display: "grid",
              gridTemplateColumns: "260px 1fr 320px",
            }}
          >
            {/* Left: Theme Library */}
            <ThemeLibrary />

            {/* Center: Design Canvas */}
            <DesignCanvas />

            {/* Right: Properties Panel */}
            <PropertiesPanel />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
