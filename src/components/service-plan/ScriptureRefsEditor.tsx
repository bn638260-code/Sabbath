import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ScriptureRef } from "@/types/service-plan"

interface ScriptureRefsEditorProps {
  refs: ScriptureRef[]
  onChange: (refs: ScriptureRef[]) => void
}

function formatScriptureRef(ref: ScriptureRef): string {
  if (ref.reference) return ref.reference
  return [ref.book, ref.chapter, ref.verse].filter(Boolean).join(" ")
}

export function ScriptureRefsEditor({ refs, onChange }: ScriptureRefsEditorProps) {
  const [scriptureInput, setScriptureInput] = useState("")

  const addScriptureRef = () => {
    const reference = scriptureInput.trim()
    if (!reference) return
    onChange([...refs, { reference }])
    setScriptureInput("")
  }

  return (
    <div className="space-y-2">
      <span className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
        Expected scripture
      </span>
      <div className="flex gap-2">
        <Input
          value={scriptureInput}
          onChange={(event) => setScriptureInput(event.target.value)}
          placeholder="John 3:16"
        />
        <Button size="sm" variant="outline" onClick={addScriptureRef}>
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {refs.map((ref, index) => (
          <Badge key={`${formatScriptureRef(ref)}-${index}`} variant="secondary" className="gap-1 text-[0.625rem]">
            {formatScriptureRef(ref)}
            <button type="button" onClick={() => onChange(refs.filter((_, i) => i !== index))}>
              x
            </button>
          </Badge>
        ))}
      </div>
    </div>
  )
}
