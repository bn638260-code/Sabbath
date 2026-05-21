import { Input } from "@/components/ui/input"
import type { ServiceItem, ServiceItemKind } from "@/types/service-plan"

const ITEM_KINDS: ServiceItemKind[] = [
  "general",
  "scripture",
  "hymn",
  "media",
  "slide",
  "announcement",
]

interface ServiceItemBasicFieldsProps {
  item: ServiceItem
  onPatchItem: (patch: Partial<ServiceItem>) => void
}

export function ServiceItemBasicFields({ item, onPatchItem }: ServiceItemBasicFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <label className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
            Title
          </label>
          <Input value={item.title} onChange={(event) => onPatchItem({ title: event.target.value })} />
        </div>
        <div className="space-y-2">
          <label className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
            Type
          </label>
          <select
            value={item.kind}
            onChange={(event) => onPatchItem({ kind: event.target.value as ServiceItemKind })}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {ITEM_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
          Duration minutes
        </label>
        <Input
          type="number"
          min={0}
          value={item.durationMinutes ?? ""}
          onChange={(event) =>
            onPatchItem({
              durationMinutes: event.target.value ? Number(event.target.value) : undefined,
            })
          }
        />
      </div>
    </>
  )
}
