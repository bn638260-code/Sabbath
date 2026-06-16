import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ImportedSlide } from "@/lib/powerpoint-import"

interface PowerPointSlidePickerProps {
  open: boolean
  slides: ImportedSlide[]
  onOpenChange: (open: boolean) => void
  onSelect: (slide: ImportedSlide) => void
}

/**
 * Modal grid of rendered PowerPoint slides. Selecting exactly one slide applies
 * it as the theme background; the picker never creates multiple themes.
 */
export function PowerPointSlidePicker({
  open,
  slides,
  onOpenChange,
  onSelect,
}: PowerPointSlidePickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select a slide background</DialogTitle>
          <DialogDescription>
            Choose one slide to apply as the current theme background image.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto p-1">
          {slides.map((slide) => (
            <button
              key={slide.index}
              type="button"
              className="group flex flex-col overflow-hidden rounded border border-white/10 transition-colors hover:border-primary"
              onClick={() => onSelect(slide)}
            >
              <img
                src={slide.dataUrl}
                alt={slide.label}
                className="aspect-video w-full object-cover"
              />
              <span className="truncate px-1 py-0.5 text-left text-[0.625rem] text-muted-foreground">
                {slide.label}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
