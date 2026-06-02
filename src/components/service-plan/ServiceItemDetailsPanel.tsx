import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { ServiceContext, ServiceItem } from "@/types/service-plan"
import { ChecklistEditor } from "./ChecklistEditor"
import { HymnRefsEditor } from "./HymnRefsEditor"
import { MediaAttachmentsEditor } from "./MediaAttachmentsEditor"
import { SermonSlidesEditor } from "./SermonSlidesEditor"
import { ScriptureRefsEditor } from "./ScriptureRefsEditor"
import { ServiceItemBasicFields } from "./ServiceItemBasicFields"

function EditorSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border/80 bg-card/40 p-4">
      <div className="text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </div>
      {children}
    </section>
  )
}

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
    <div
      className="flex h-full flex-col gap-4 overflow-y-auto p-4"
      data-slot="service-item-details"
    >
      <ServiceItemBasicFields item={item} onPatchItem={onPatchItem} />

      <EditorSection title="Operator notes">
        <Textarea
          value={item.notes ?? ""}
          onChange={(event) => onPatchItem({ notes: event.target.value })}
          rows={4}
        />
      </EditorSection>

      <EditorSection title="Scripture references">
        <ScriptureRefsEditor
          refs={item.scriptureRefs}
          onChange={(scriptureRefs) => onPatchItem({ scriptureRefs })}
        />
      </EditorSection>

      <EditorSection title="Hymn references">
        <HymnRefsEditor
          refs={item.hymnRefs}
          onChange={(hymnRefs) => onPatchItem({ hymnRefs })}
        />
      </EditorSection>

      <EditorSection title="Sermon slides">
        <SermonSlidesEditor
          attachments={item.attachments.filter(
            (attachment) => attachment.kind === "slide"
          )}
          onChange={(slides) =>
            onPatchItem({
              attachments: [
                ...slides,
                ...item.attachments.filter(
                  (attachment) => attachment.kind !== "slide"
                ),
              ],
            })
          }
        />
      </EditorSection>

      <EditorSection title="Attachments and documents">
        <MediaAttachmentsEditor
          attachments={item.attachments.filter(
            (attachment) => attachment.kind !== "slide"
          )}
          onChange={(documents) =>
            onPatchItem({
              attachments: [
                ...item.attachments.filter(
                  (attachment) => attachment.kind === "slide"
                ),
                ...documents,
              ],
            })
          }
        />
      </EditorSection>

      <EditorSection title="Checklist">
        <ChecklistEditor
          items={item.checklist}
          onChange={(checklist) => onPatchItem({ checklist })}
        />
      </EditorSection>

      <div className="mt-auto flex flex-wrap gap-3 border-t border-border pt-4">
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
