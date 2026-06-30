import { useBroadcastDesignerStore as useBroadcastStore } from "@/stores/broadcast/designer-store"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TextProperties } from "@/components/broadcast/text-properties"
import { BackgroundProperties } from "@/components/broadcast/background-properties"
import { LayoutProperties } from "@/components/broadcast/layout-properties"

export function PropertiesPanel() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const selectedElement = useBroadcastStore((s) => s.selectedElement)

  if (!draftTheme) {
    return (
      <div className="glass-panel relative flex h-full flex-col items-center justify-center border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
        <p className="text-sm text-muted-foreground">Select a theme to edit</p>
      </div>
    )
  }

  const isKinetic = Boolean(draftTheme.kinetic)

  const subtitle =
    selectedElement === "verse"
      ? "Editing verse properties"
      : selectedElement === "reference"
        ? "Editing reference properties"
        : "Select an element or use tabs below"

  return (
    <div className="glass-panel relative flex h-full min-h-0 flex-col overflow-hidden border-l border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      {/* Header */}
      <div className="flex h-14 flex-col gap-0.5 border-b border-border px-4 py-2">
        <h3 className="truncate text-sm font-semibold">{draftTheme.name}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      {/* Kinetic preset notice: motion is preset-driven, not hand-editable here. */}
      {isKinetic && (
        <div className="border-b border-border bg-indigo-500/10 px-4 py-2">
          <p className="text-[0.6875rem] leading-4 text-muted-foreground">
            <span className="font-semibold text-indigo-400">Kinetic preset.</span>{" "}
            Its moving background is preset-driven. Text and layout are editable;
            the Background tab edits only the static fallback shown if motion is
            unavailable.
          </p>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="text" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-4 pt-3">
          <TabsList variant="default" className="w-full">
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="background">Background</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <TabsContent value="text" className="mt-0 p-4">
            <TextProperties />
          </TabsContent>
          <TabsContent value="background" className="mt-0 p-4">
            <BackgroundProperties />
          </TabsContent>
          <TabsContent value="layout" className="mt-0 p-4">
            <LayoutProperties />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}
