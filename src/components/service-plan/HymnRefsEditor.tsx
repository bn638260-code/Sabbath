import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { HymnRef } from "@/types/service-plan"

interface HymnRefsEditorProps {
  refs: HymnRef[]
  onChange: (refs: HymnRef[]) => void
}

export function HymnRefsEditor({ refs, onChange }: HymnRefsEditorProps) {
  const [hymnInput, setHymnInput] = useState("")

  const addHymnRef = () => {
    const hymnNumber = Number.parseInt(hymnInput, 10)
    if (!Number.isFinite(hymnNumber) || hymnNumber <= 0) return
    onChange([
      ...refs,
      { hymnNumber, hymnId: `sda-${hymnNumber}`, title: `Hymn ${hymnNumber}` },
    ])
    setHymnInput("")
  }

  return (
    <div className="space-y-2">
      <span className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
        Hymns
      </span>
      <div className="flex gap-2">
        <Input
          type="number"
          min={1}
          value={hymnInput}
          onChange={(event) => setHymnInput(event.target.value)}
          placeholder="Hymn #"
        />
        <Button size="sm" variant="outline" onClick={addHymnRef}>
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {refs.map((hymn, index) => (
          <Badge key={`${hymn.hymnNumber}-${index}`} variant="secondary" className="gap-1 text-[0.625rem]">
            {hymn.title ?? `Hymn ${hymn.hymnNumber}`}
            <button type="button" onClick={() => onChange(refs.filter((_, i) => i !== index))}>
              x
            </button>
          </Badge>
        ))}
      </div>
    </div>
  )
}
