import { beforeEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const mockInvoke = vi.fn()
const mockRender = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock("@/lib/pdf-slide-renderer", () => ({
  renderPdfToSlides: (...args: unknown[]) => mockRender(...args),
}))

async function loadModule() {
  vi.resetModules()
  return import("./powerpoint-import")
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

describe("importPowerPointSlides", () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockRender.mockReset()
  })

  it("converts the deck and returns ordered, labelled slides", async () => {
    mockInvoke.mockResolvedValue({ fileName: "Sermon.pptx", pdfBase64: "PDF64" })
    mockRender.mockResolvedValue([
      { index: 0, dataUrl: "data:img0", width: 4, height: 3 },
      { index: 1, dataUrl: "data:img1", width: 4, height: 3 },
    ])

    const { importPowerPointSlides } = await loadModule()
    const slides = await importPowerPointSlides("C:/decks/Sermon.pptx")

    expect(mockInvoke).toHaveBeenCalledWith("convert_powerpoint_to_pdf", {
      path: "C:/decks/Sermon.pptx",
    })
    expect(mockRender).toHaveBeenCalledWith("PDF64")
    expect(slides).toEqual([
      { index: 0, dataUrl: "data:img0", label: "Sermon — Slide 1" },
      { index: 1, dataUrl: "data:img1", label: "Sermon — Slide 2" },
    ])
  })
})

describe("slidesToAttachments", () => {
  it("appends ordered sermon-slide attachments after the start order", async () => {
    const { slidesToAttachments } = await loadModule()
    const attachments = slidesToAttachments(
      [
        { index: 0, dataUrl: "data:a", label: "Deck — Slide 1" },
        { index: 1, dataUrl: "data:b", label: "Deck — Slide 2" },
      ],
      3
    )

    expect(attachments.map((a) => a.order)).toEqual([3, 4])
    expect(attachments.map((a) => a.thumbnailUrl)).toEqual(["data:a", "data:b"])
    expect(attachments.every((a) => a.kind === "slide")).toBe(true)
    expect(attachments.every((a) => a.status === "ready")).toBe(true)
    expect(attachments[0].label).toBe("Deck — Slide 1")
    expect(attachments[0].id).not.toBe(attachments[1].id)
  })

  it("returns no attachments for an empty slide list", async () => {
    const { slidesToAttachments } = await loadModule()
    expect(slidesToAttachments([], 0)).toEqual([])
  })
})

describe("pdf-slide-renderer pdfjs loading", () => {
  it("imports pdfjs-dist lazily, never as a top-level value import", () => {
    const source = readSource("src/lib/pdf-slide-renderer.ts")
    expect(source).toContain('await import("pdfjs-dist")')
    // The only top-level pdfjs reference must be the erasable type import.
    expect(source).toMatch(/import type \{[^}]*\} from "pdfjs-dist"/)
    expect(source).not.toMatch(/import \{[^}]*\} from "pdfjs-dist"/)
  })
})
