import { open } from "@tauri-apps/plugin-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  attachmentSizeLimitError,
  FALLBACK_ATTACHMENT_LIMITS,
  formatAttachmentLimit,
  loadServiceAttachmentLimits,
} from "@/lib/attachment-limits"
import { invokeTauri } from "@/lib/tauri-runtime"
import {
  importPowerPointSlides,
  POWERPOINT_EXTENSIONS,
  slidesToAttachments,
} from "@/lib/powerpoint-import"
import type { ServiceAttachment } from "@/types/service-plan"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PresentationIcon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import { useEffect, useState } from "react"

const SERMON_SLIDE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"]

interface ServiceAttachmentValidation {
  label: string
  kind: ServiceAttachment["kind"]
  sizeBytes: number
}

interface SermonSlidesEditorProps {
  attachments: ServiceAttachment[]
  onChange: (attachments: ServiceAttachment[]) => void
  applyTheme?: boolean
  onApplyThemeChange?: (applyTheme: boolean) => void
}

function nextOrder(attachments: ServiceAttachment[]): number {
  return (
    attachments.reduce(
      (max, attachment) => Math.max(max, attachment.order ?? -1),
      -1
    ) + 1
  )
}

async function createSlideAttachment(
  path: string,
  order: number
): Promise<ServiceAttachment> {
  const validated = await invokeTauri<ServiceAttachmentValidation>(
    "validate_service_attachment_path",
    { path }
  )
  if (validated.kind !== "slide") {
    throw new Error("Select a PNG, JPEG, WebP, or GIF image.")
  }
  const thumbnailUrl = await invokeTauri<string>("read_image_as_data_url", {
    path,
  })
  return {
    id: crypto.randomUUID(),
    kind: "slide",
    label: validated.label,
    path,
    status: "ready",
    sizeBytes: validated.sizeBytes,
    thumbnailUrl,
    order,
  }
}

function orderedSlides(attachments: ServiceAttachment[]): ServiceAttachment[] {
  return [...attachments].sort(
    (a, b) =>
      (a.order ?? attachments.indexOf(a)) - (b.order ?? attachments.indexOf(b))
  )
}

export function SermonSlidesEditor({
  attachments,
  onChange,
  applyTheme,
  onApplyThemeChange,
}: SermonSlidesEditorProps) {
  const slides = orderedSlides(attachments)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [importingDeck, setImportingDeck] = useState(false)
  const [slideLimitLabel, setSlideLimitLabel] = useState(() =>
    formatAttachmentLimit("slide", FALLBACK_ATTACHMENT_LIMITS),
  )
  const imageFallbackCount = applyTheme
    ? slides.filter(
        (slide) =>
          Array.isArray(slide.extractedTextLines) &&
          slide.extractedTextLines.length === 0
      ).length
    : 0

  useEffect(() => {
    void loadServiceAttachmentLimits().then((limits) => {
      setSlideLimitLabel(formatAttachmentLimit("slide", limits))
    })
  }, [])

  const uploadSlides = async () => {
    setErrorMessage(null)
    let selected: string | string[] | null
    try {
      selected = await open({
        multiple: true,
        filters: [
          { name: "Sermon slide images", extensions: SERMON_SLIDE_EXTENSIONS },
        ],
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not open the image picker."
      )
      return
    }

    const paths = Array.isArray(selected)
      ? selected
      : selected
        ? [selected]
        : []
    if (paths.length === 0) return

    let order = nextOrder(attachments)
    const results = await Promise.allSettled(
      paths.map((path) => {
        const currentOrder = order
        order += 1
        return createSlideAttachment(path, currentOrder)
      })
    )
    const uploaded = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    )
    const failedCount = results.length - uploaded.length

    if (uploaded.length > 0) onChange([...attachments, ...uploaded])
    if (failedCount > 0) {
      const limits = await loadServiceAttachmentLimits()
      setErrorMessage(
        attachmentSizeLimitError("slide", limits, failedCount, "image"),
      )
    }
  }

  const importPowerPoint = async () => {
    setErrorMessage(null)
    let selected: string | string[] | null
    try {
      selected = await open({
        multiple: false,
        filters: [
          { name: "PowerPoint presentations", extensions: POWERPOINT_EXTENSIONS },
        ],
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not open the PowerPoint picker."
      )
      return
    }

    if (!selected || Array.isArray(selected)) return

    setImportingDeck(true)
    try {
      const imported = await importPowerPointSlides(selected)
      if (imported.length === 0) {
        setErrorMessage("No slides were found in that presentation.")
        return
      }
      const appended = slidesToAttachments(imported, nextOrder(attachments))
      onChange([...attachments, ...appended])
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not import the PowerPoint file."
      )
    } finally {
      setImportingDeck(false)
    }
  }

  const updateSlide = (id: string, patch: Partial<ServiceAttachment>) => {
    onChange(
      attachments.map((attachment) =>
        attachment.id === id ? { ...attachment, ...patch } : attachment
      )
    )
  }

  const removeSlide = (id: string) => {
    onChange(
      orderedSlides(
        attachments.filter((attachment) => attachment.id !== id)
      ).map((slide, index) => ({
        ...slide,
        order: index,
      }))
    )
  }

  const moveSlide = (id: string, delta: number) => {
    const next = orderedSlides(attachments)
    const index = next.findIndex((slide) => slide.id === id)
    const targetIndex = index + delta
    if (index < 0 || targetIndex < 0 || targetIndex >= next.length) return
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved)
    onChange(next.map((slide, order) => ({ ...slide, order })))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
          Sermon slides
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {slides.length} slides
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => void uploadSlides()}
          >
            <UploadIcon className="size-3" />
            Upload PNG / images
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={importingDeck}
            onClick={() => void importPowerPoint()}
          >
            <PresentationIcon className="size-3" />
            {importingDeck ? "Importing…" : "Import PowerPoint"}
          </Button>
        </div>
      </div>

      {onApplyThemeChange ? (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={applyTheme ?? false}
            onChange={(event) => onApplyThemeChange(event.target.checked)}
            className="h-3.5 w-3.5 rounded border-[var(--border-subtle)] accent-primary"
          />
          Apply current theme to these slides
        </label>
      ) : null}

      {imageFallbackCount > 0 ? (
        <p className="text-[0.625rem] text-muted-foreground">
          {imageFallbackCount}{" "}
          {imageFallbackCount === 1 ? "slide was" : "slides were"} kept as
          images because no text was found.
        </p>
      ) : null}

      {errorMessage ? (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {slides.length === 0 ? (
        <p className="rounded-md border border-dashed border-[var(--border-subtle)] px-3 py-4 text-xs text-muted-foreground">
          Add PNG, JPEG, WebP, or GIF slides for this service item. Each image
          may be up to {slideLimitLabel}. Voice commands control only these
          slides while this item is active.
        </p>
      ) : (
        <div className="space-y-1.5">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[var(--border-subtle)] p-2"
            >
              <div className="flex aspect-video items-center justify-center overflow-hidden rounded bg-[var(--shell-bg-sunken)]">
                {slide.thumbnailUrl ? (
                  <img
                    src={slide.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-[0.625rem] text-muted-foreground">
                    {index + 1}
                  </span>
                )}
              </div>
              <Input
                value={slide.label}
                onChange={(event) =>
                  updateSlide(slide.id, { label: event.target.value })
                }
                className="h-8 text-xs"
                aria-label={`Slide ${index + 1} label`}
              />
              <div className="flex items-center gap-1">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => moveSlide(slide.id, -1)}
                >
                  <ChevronUpIcon className="size-3" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={index === slides.length - 1}
                  onClick={() => moveSlide(slide.id, 1)}
                >
                  <ChevronDownIcon className="size-3" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => removeSlide(slide.id)}
                >
                  <XIcon className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
