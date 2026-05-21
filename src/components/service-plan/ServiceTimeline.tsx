import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ServiceItem } from "@/types/service-plan"
import {
  CheckIcon,
  CopyIcon,
  GripVerticalIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react"

interface ServiceTimelineProps {
  items: ServiceItem[]
  activeItemId: string | null
  performanceMode: boolean
  onSelect: (itemId: string) => void
  onDuplicate: (itemId: string) => void
  onDelete: (itemId: string) => void
  onMarkReady: (itemId: string) => void
  onComplete: (itemId: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
}

export function ServiceTimeline({
  items,
  activeItemId,
  performanceMode,
  onSelect,
  onDuplicate,
  onDelete,
  onMarkReady,
  onComplete,
  onReorder,
}: ServiceTimelineProps) {
  const ordered = [...items].sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col gap-1 overflow-y-auto pr-1" data-slot="service-timeline">
      {ordered.length === 0 ? (
        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
          No service items yet. Add items or start from a template.
        </p>
      ) : (
        ordered.map((item, index) => {
          const isActive = item.id === activeItemId
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-start gap-2 rounded-md border border-border/60 bg-card/60 px-2 py-2",
                isActive && "border-primary/50 bg-primary/5",
              )}
            >
              <button
                type="button"
                className="mt-1 cursor-grab text-muted-foreground"
                title="Reorder"
                draggable={!performanceMode}
                onDragStart={() => {
                  if (performanceMode) return
                  ;(window as unknown as { __serviceDragIndex?: number }).__serviceDragIndex = index
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  const from = (window as unknown as { __serviceDragIndex?: number }).__serviceDragIndex
                  if (typeof from === "number" && from !== index) onReorder(from, index)
                }}
              >
                <GripVerticalIcon className="size-3.5" />
              </button>

              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onSelect(item.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{item.title}</span>
                  <Badge variant="outline" className="shrink-0 text-[0.5rem] uppercase">
                    {item.kind}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[0.625rem] text-muted-foreground">
                  <span className="capitalize">{item.status}</span>
                  {item.durationMinutes ? <span>{item.durationMinutes} min</span> : null}
                </div>
              </button>

              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Set active"
                  onClick={() => onSelect(item.id)}
                >
                  <PlayIcon className="size-3.5" />
                </Button>
                {!performanceMode && (
                  <>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Mark ready"
                      onClick={() => onMarkReady(item.id)}
                    >
                      <CheckIcon className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Duplicate"
                      onClick={() => onDuplicate(item.id)}
                    >
                      <CopyIcon className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Delete"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </>
                )}
                {isActive && (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title="Complete"
                    onClick={() => onComplete(item.id)}
                  >
                    <CheckIcon className="size-3.5 text-emerald-500" />
                  </Button>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
