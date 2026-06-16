import { invokeTauri } from "@/lib/tauri-runtime"
import { renderPdfToSlides } from "@/lib/pdf-slide-renderer"
import type { ServiceAttachment } from "@/types/service-plan"

/** File extensions accepted by the PowerPoint import flows. */
export const POWERPOINT_EXTENSIONS = ["ppt", "pptx"]

/** Response from the `convert_powerpoint_to_pdf` Tauri command. */
interface PowerPointConversion {
  fileName: string
  pdfBase64: string
}

/** A single rendered slide ready to become an attachment or theme background. */
export interface ImportedSlide {
  index: number
  dataUrl: string
  label: string
}

function deckBaseName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^./\\]+$/, "")
  return withoutExtension.trim() || "Slide"
}

/**
 * Convert a local `.ppt`/`.pptx` at `path` to an ordered list of rendered
 * slide images. The deck is converted to PDF by LibreOffice (backend) and
 * rendered to images lazily with pdfjs-dist (frontend).
 */
export async function importPowerPointSlides(
  path: string
): Promise<ImportedSlide[]> {
  const conversion = await invokeTauri<PowerPointConversion>(
    "convert_powerpoint_to_pdf",
    { path }
  )
  const rendered = await renderPdfToSlides(conversion.pdfBase64)
  const base = deckBaseName(conversion.fileName)
  return rendered.map((slide) => ({
    index: slide.index,
    dataUrl: slide.dataUrl,
    label: `${base} — Slide ${slide.index + 1}`,
  }))
}

/**
 * Build ordered sermon-slide attachments from imported slides, numbered so
 * they append after the existing slides (`startOrder`).
 */
export function slidesToAttachments(
  slides: ImportedSlide[],
  startOrder: number
): ServiceAttachment[] {
  return slides.map((slide, offset) => ({
    id: crypto.randomUUID(),
    kind: "slide",
    label: slide.label,
    status: "ready",
    thumbnailUrl: slide.dataUrl,
    order: startOrder + offset,
  }))
}
