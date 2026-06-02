import { open } from "@tauri-apps/plugin-dialog"
import { Button } from "@/components/ui/button"
import { invokeTauri } from "@/lib/tauri-runtime"
import type { ServiceAttachment } from "@/types/service-plan"
import { useState } from "react"

const SUPPORTED_ATTACHMENT_EXTENSIONS = ["pdf"]

interface ServiceAttachmentValidation {
  label: string
  kind: ServiceAttachment["kind"]
  sizeBytes: number
}

interface MediaAttachmentsEditorProps {
  attachments: ServiceAttachment[]
  onChange: (attachments: ServiceAttachment[]) => void
}

async function createAttachmentFromPath(
  path: string
): Promise<ServiceAttachment> {
  const validated = await invokeTauri<ServiceAttachmentValidation>(
    "validate_service_attachment_path",
    { path }
  )
  return {
    id: crypto.randomUUID(),
    kind: validated.kind,
    label: validated.label,
    path,
    status: "pending",
    sizeBytes: validated.sizeBytes,
  }
}

export function MediaAttachmentsEditor({
  attachments,
  onChange,
}: MediaAttachmentsEditorProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const attachFiles = async () => {
    setErrorMessage(null)
    let selected: string | string[] | null
    try {
      selected = await open({
        multiple: true,
        filters: [
          {
            name: "PDF documents",
            extensions: SUPPORTED_ATTACHMENT_EXTENSIONS,
          },
        ],
      })
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not open the PDF picker."
      )
      return
    }

    const paths = Array.isArray(selected)
      ? selected
      : selected
        ? [selected]
        : []
    if (paths.length === 0) return

    const results = await Promise.allSettled(
      paths.map((path) => createAttachmentFromPath(path))
    )
    const selectedAttachments = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    )
    const failedCount = results.length - selectedAttachments.length

    if (selectedAttachments.length > 0) {
      onChange([...attachments, ...selectedAttachments])
    }
    if (failedCount > 0) {
      setErrorMessage(
        `${failedCount} PDF${failedCount === 1 ? "" : "s"} could not be attached. Use local files smaller than 100 MB.`
      )
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
          Documents
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => void attachFiles()}
        >
          Attach PDF
        </Button>
      </div>
      {errorMessage ? (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      ) : null}
      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No PDF documents attached.
        </p>
      ) : (
        <div className="space-y-1 text-xs">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between rounded-md border border-border px-2 py-1"
            >
              <span className="truncate">
                {attachment.label}{" "}
                <span className="text-muted-foreground">
                  ({attachment.kind})
                </span>
                {typeof attachment.sizeBytes === "number" && (
                  <span className="text-muted-foreground">
                    {" "}
                    - {(attachment.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                )}
              </span>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() =>
                  onChange(
                    attachments.filter((entry) => entry.id !== attachment.id)
                  )
                }
              >
                x
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
