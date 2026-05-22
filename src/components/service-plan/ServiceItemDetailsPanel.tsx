import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ServiceContext, ServiceItem } from "@/types/service-plan"
import { ChecklistEditor } from "./ChecklistEditor"
import { HymnRefsEditor } from "./HymnRefsEditor"
import { MediaAttachmentsEditor } from "./MediaAttachmentsEditor"
import { ScriptureRefsEditor } from "./ScriptureRefsEditor"
import { ServiceItemBasicFields } from "./ServiceItemBasicFields"

interface ServiceItemDetailsPanelProps {
  item: ServiceItem | null
  serviceContext: ServiceContext
  onPatchItem: (patch: Partial<ServiceItem>) => void
  onEnqueuePrepared: () => void
  onPracticePreview: () => void
}

export function ServiceItemDetailsPanel({
  item,
  serviceContext,
  onPatchItem,
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
      <ServiceItemBasicFields item={item} onPatchItem={onPatchItem} />

      <div className="space-y-2">
        <label className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
          Operator notes
        </label>
        <Textarea
          value={item.notes ?? ""}
          onChange={(event) => onPatchItem({ notes: event.target.value })}
          rows={4}
        />
      </div>

      <ScriptureRefsEditor
        refs={item.scriptureRefs}
        onChange={(scriptureRefs) => onPatchItem({ scriptureRefs })}
      />

      <HymnRefsEditor
        refs={item.hymnRefs}
        onChange={(hymnRefs) => onPatchItem({ hymnRefs })}
      />

      <MediaAttachmentsEditor
        attachments={item.attachments}
        onChange={(attachments) => onPatchItem({ attachments })}
      />

      <ChecklistEditor
        items={item.checklist}
        onChange={(checklist) => onPatchItem({ checklist })}
      />

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
