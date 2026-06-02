import { describe, expect, it } from "vitest"
import {
  FALLBACK_ATTACHMENT_LIMITS,
  formatAttachmentLimit,
  formatAttachmentLimitBytes,
} from "./attachment-limits"

describe("attachment limit display", () => {
  it("renders exact mixed-unit strings from backend byte caps", () => {
    expect(formatAttachmentLimitBytes(FALLBACK_ATTACHMENT_LIMITS.slide)).toBe(
      "10,000,000 bytes (10.0 MB / 9.54 MiB)",
    )
    expect(formatAttachmentLimit("document", FALLBACK_ATTACHMENT_LIMITS)).toBe(
      "104,857,600 bytes (104.9 MB / 100.00 MiB)",
    )
    expect(formatAttachmentLimit("media", FALLBACK_ATTACHMENT_LIMITS)).toBe(
      "786,432,000 bytes (786.4 MB / 750.00 MiB)",
    )
  })
})
