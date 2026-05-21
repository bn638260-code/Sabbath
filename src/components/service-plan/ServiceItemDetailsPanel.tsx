import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { ServiceContext, ServiceItem } from "@/types/service-plan"

interface ServiceItemDetailsPanelProps {
  item: ServiceItem | null
  serviceContext: ServiceContext
  onUpdateTitle: (title: string) => void
  onUpdateNotes: (notes: string) => void
  onAddHymnRef: (hymnNumber: number) => void
  onEnqueuePrepared: () => void
  onPracticePreview: () => void
}

export function ServiceItemDetailsPanel({
  item,
  serviceContext,
  onUpdateTitle,
  onUpdateNotes,
  onAddHymnRef,
  onEnqueuePrepared,
  onPracticePreview,
}: ServiceItemDetailsPanelProps) {
  if (!item) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-xs text-muted-foreground">
        Select a service item to edit details.
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3" data-slot="service-item-details">
      <div className="space-y-2">
        <label className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
          Title
        </label>
        <Input value={item.title} onChange={(event) => onUpdateTitle(event.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
          Operator notes
        </label>
        <Textarea
          value={item.notes ?? ""}
          onChange={(event) => onUpdateNotes(event.target.value)}
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
            Expected references
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onAddHymnRef(1)}
          >
            Add hymn #1
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {serviceContext.expectedReferences.length === 0 ? (
            <span className="text-xs text-muted-foreground">No references attached.</span>
          ) : (
            serviceContext.expectedReferences.map((ref) => (
              <Badge key={ref} variant="secondary" className="text-[0.625rem]">
                {ref}
              </Badge>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
          Checklist
        </span>
        {item.checklist.length === 0 ? (
          <p className="text-xs text-muted-foreground">No checklist items.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {item.checklist.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2">
                <input type="checkbox" checked={entry.done} readOnly />
                <span>{entry.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
        <Button size="sm" variant="outline" onClick={onEnqueuePrepared}>
          Queue prepared resources
        </Button>
        {serviceContext.mode === "practice" && (
          <Button size="sm" variant="secondary" onClick={onPracticePreview}>
            Practice preview
          </Button>
        )}
      </div>
    </div>
  )
}
