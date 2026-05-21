import { open } from "@tauri-apps/plugin-dialog"
import { Button } from "@/components/ui/button"
import type { ServiceAttachment } from "@/types/service-plan"

const SUPPORTED_ATTACHMENT_EXTENSIONS = [
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "mp4",
  "mov",
  "webm",
  "pdf",
]

interface MediaAttachmentsEditorProps {
  attachments: ServiceAttachment[]
  onChange: (attachments: ServiceAttachment[]) => void
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).pop()?.trim() || "Attachment"
}

function extensionFromPath(path: string): string {
  return fileNameFromPath(path).split(".").pop()?.toLowerCase() ?? ""
}

function attachmentKindFromPath(path: string): ServiceAttachment["kind"] {
  const extension = extensionFromPath(path)
  if (["png", "jpg", "jpeg", "webp", "gif", "pdf"].includes(extension)) return "slide"
  if (["mp4", "mov", "webm"].includes(extension)) return "media"
  return "document"
}

function isSupportedAttachmentPath(path: string): boolean {
  return SUPPORTED_ATTACHMENT_EXTENSIONS.includes(extensionFromPath(path))
}

export function MediaAttachmentsEditor({ attachments, onChange }: MediaAttachmentsEditorProps) {
  const attachFiles = async () => {
    let selected: string | string[] | null
    try {
      selected = await open({
        multiple: true,
        filters: [
          {
            name: "Slides and media",
            extensions: SUPPORTED_ATTACHMENT_EXTENSIONS,
          },
        ],
      })
    } catch {
      return
    }

    const paths = (Array.isArray(selected) ? selected : selected ? [selected] : []).filter(
      isSupportedAttachmentPath,
    )
    if (paths.length === 0) return

    onChange([
      ...attachments,
      ...paths.map((path) => ({
        id: crypto.randomUUID(),
        kind: attachmentKindFromPath(path),
        label: fileNameFromPath(path),
        path,
        status: "pending" as const,
      })),
    ])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
          Slides and media
        </span>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void attachFiles()}>
          Attach files
        </Button>
      </div>
      {attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No slide or media files attached.</p>
      ) : (
        <div className="space-y-1 text-xs">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1">
              <span className="truncate">
                {attachment.label} <span className="text-muted-foreground">({attachment.kind})</span>
              </span>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => onChange(attachments.filter((entry) => entry.id !== attachment.id))}
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
