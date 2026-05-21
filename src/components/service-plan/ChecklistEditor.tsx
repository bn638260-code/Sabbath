import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ServiceChecklistItem } from "@/types/service-plan"

interface ChecklistEditorProps {
  items: ServiceChecklistItem[]
  onChange: (items: ServiceChecklistItem[]) => void
}

export function ChecklistEditor({ items, onChange }: ChecklistEditorProps) {
  const [checklistInput, setChecklistInput] = useState("")

  const addChecklistItem = () => {
    const label = checklistInput.trim()
    if (!label) return
    onChange([...items, { id: crypto.randomUUID(), label, done: false }])
    setChecklistInput("")
  }

  return (
    <div className="space-y-2">
      <span className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
        Checklist
      </span>
      <div className="flex gap-2">
        <Input
          value={checklistInput}
          onChange={(event) => setChecklistInput(event.target.value)}
          placeholder="Projector checked"
        />
        <Button size="sm" variant="outline" onClick={addChecklistItem}>
          Add
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No checklist items.</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {items.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={entry.done}
                onChange={(event) =>
                  onChange(
                    items.map((check) =>
                      check.id === entry.id ? { ...check, done: event.target.checked } : check,
                    ),
                  )
                }
              />
              <span className="flex-1">{entry.label}</span>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onChange(items.filter((check) => check.id !== entry.id))}
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
