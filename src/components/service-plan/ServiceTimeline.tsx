import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ServiceItem } from "@/types/service-plan"
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
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
  onActivate: (itemId: string) => void
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
  onActivate,
  onDuplicate,
  onDelete,
  onMarkReady,
  onComplete,
  onReorder,
}: ServiceTimelineProps) {
  const ordered = [...items].sort((a, b) => a.order - b.order)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div
      className="flex flex-col gap-1 overflow-y-auto pr-1"
      data-slot="service-timeline"
    >
      {ordered.length === 0 ? (
        <p className="px-2 py-6 text-center text-xs text-muted-foreground">
          No service items yet. Add items or start from a template.
        </p>
      ) : (
        ordered.map((item, index) => {
          const isActive = item.id === activeItemId
          const expanded = expandedId === item.id
          return (
            <div
              key={item.id}
              className={cn(
                "rounded-md border border-border/60 bg-card/60",
                isActive && "border-primary/50 bg-primary/5"
              )}
            >
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <button
                  type="button"
                  className="cursor-pointer text-muted-foreground"
                  title="Reorder"
                  draggable={!performanceMode}
                  onDragStart={() => {
                    if (performanceMode) return
                    ;(
                      window as unknown as { __serviceDragIndex?: number }
                    ).__serviceDragIndex = index
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    const from = (
                      window as unknown as { __serviceDragIndex?: number }
                    ).__serviceDragIndex
                    if (typeof from === "number" && from !== index)
                      onReorder(from, index)
                  }}
                >
                  <GripVerticalIcon className="size-3" />
                </button>

                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => onSelect(item.id)}
                >
                  <span className="truncate text-xs font-medium">
                    {item.title}
                  </span>
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[0.5rem] uppercase"
                  >
                    {item.kind}
                  </Badge>
                  <span className="shrink-0 text-[0.625rem] text-muted-foreground capitalize">
                    {item.status}
                  </span>
                </button>

                {isActive && (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="Complete"
                    onClick={() => onComplete(item.id)}
                  >
                    <CheckIcon className="size-3 text-emerald-500" />
                  </Button>
                )}

                <Button
                  size="icon-xs"
                  variant="ghost"
                  title={expanded ? "Collapse" : "Expand"}
                  onClick={() => toggleExpand(item.id)}
                >
                  {expanded ? (
                    <ChevronDownIcon className="size-3" />
                  ) : (
                    <ChevronRightIcon className="size-3" />
                  )}
                </Button>
              </div>

              {expanded && (
                <div className="border-t border-border/40 px-2 py-1.5">
                  {item.durationMinutes ? (
                    <div className="mb-1 text-[0.625rem] text-muted-foreground">
                      Duration: {item.durationMinutes} min
                    </div>
                  ) : null}
                  <div className="flex items-center gap-1">
                    <Button
                      size="xs"
                      variant="ghost"
                      title="Set active"
                      onClick={() => onActivate(item.id)}
                    >
                      <PlayIcon className="size-3" />
                      <span className="ml-1 text-[0.625rem]">Active</span>
                    </Button>
                    {!performanceMode && (
                      <>
                        <Button
                          size="xs"
                          variant="ghost"
                          title="Mark ready"
                          onClick={() => onMarkReady(item.id)}
                        >
                          <CheckIcon className="size-3" />
                          <span className="ml-1 text-[0.625rem]">Ready</span>
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          title="Duplicate"
                          onClick={() => onDuplicate(item.id)}
                        >
                          <CopyIcon className="size-3" />
                          <span className="ml-1 text-[0.625rem]">Dup</span>
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          title="Delete"
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2Icon className="size-3" />
                          <span className="ml-1 text-[0.625rem]">Del</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
