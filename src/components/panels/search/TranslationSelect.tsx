import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { changeActiveTranslation } from "@/lib/search-panel-state"
import type { Translation } from "@/types"

export function TranslationSelect({
  translations,
  activeTranslationId,
}: {
  translations: Translation[]
  activeTranslationId: number
}) {
  const isLocked = (translation: Translation) =>
    translation.is_copyrighted || !translation.is_downloaded

  return (
    <Select
      value={String(activeTranslationId)}
      onValueChange={async (value) => {
        try {
          await changeActiveTranslation(Number(value))
        } catch (err) {
          console.error(err)
        }
      }}
    >
      <SelectTrigger size="sm" className="h-7 w-[72px] shrink-0 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {translations.map((translation) => (
          <SelectItem
            key={translation.id}
            value={String(translation.id)}
            disabled={isLocked(translation)}
          >
            {translation.abbreviation}
            {isLocked(translation) ? " (Coming soon)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
