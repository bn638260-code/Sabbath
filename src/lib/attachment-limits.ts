import { invokeTauri } from "@/lib/tauri-runtime"

export type AttachmentLimitKind = "slide" | "document" | "media"

export interface ServiceAttachmentLimits {
  slide: number
  document: number
  media: number
}

export const FALLBACK_ATTACHMENT_LIMITS: ServiceAttachmentLimits = {
  slide: 10_000_000,
  document: 100 * 1024 * 1024,
  media: 750 * 1024 * 1024,
}

let cachedLimits: ServiceAttachmentLimits | null = null

export async function loadServiceAttachmentLimits(): Promise<ServiceAttachmentLimits> {
  if (cachedLimits) return cachedLimits
  try {
    cachedLimits = await invokeTauri<ServiceAttachmentLimits>(
      "get_service_attachment_limits",
    )
    return cachedLimits
  } catch {
    return FALLBACK_ATTACHMENT_LIMITS
  }
}

/** Exact mixed-unit copy: decimal MB and binary MiB from the backend byte cap. */
export function formatAttachmentLimitBytes(bytes: number): string {
  const formattedBytes = bytes.toLocaleString("en-US")
  const decimalMb = bytes / 1_000_000
  const binaryMib = bytes / (1024 * 1024)
  return `${formattedBytes} bytes (${decimalMb.toFixed(1)} MB / ${binaryMib.toFixed(2)} MiB)`
}

export function formatAttachmentLimit(
  kind: AttachmentLimitKind,
  limits: ServiceAttachmentLimits,
): string {
  return formatAttachmentLimitBytes(limits[kind])
}

export function attachmentSizeLimitError(
  kind: AttachmentLimitKind,
  limits: ServiceAttachmentLimits,
  count: number,
  noun: string,
): string {
  const limit = formatAttachmentLimit(kind, limits)
  return `${count} ${noun}${count === 1 ? "" : "s"} could not be added. Use local files up to ${limit}.`
}
