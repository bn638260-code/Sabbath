import type { PDFDocumentProxy } from "pdfjs-dist"

export interface RenderedSlide {
  index: number
  dataUrl: string
  width: number
  height: number
}

export interface RenderPdfOptions {
  /** Rendering scale. Larger renders sharper slides at higher memory cost. */
  scale?: number
  /** Hard cap on slides rendered from a single deck. */
  maxSlides?: number
}

const DEFAULT_SCALE = 1.5
const DEFAULT_MAX_SLIDES = 200

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// pdfjs-dist is heavy; load it (and its worker) lazily so it never enters the
// normal app-startup bundle. Only the PowerPoint import path pays the cost.
let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null

async function loadPdfjs(): Promise<typeof import("pdfjs-dist")> {
  pdfjsPromise ??= (async () => {
    const pdfjs = await import("pdfjs-dist")
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(
      new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
      { type: "module" }
    )
    return pdfjs
  })()
  return pdfjsPromise
}

async function renderDocument(
  doc: PDFDocumentProxy,
  scale: number,
  maxSlides: number
): Promise<RenderedSlide[]> {
  const slides: RenderedSlide[] = []
  const pageCount = Math.min(doc.numPages, maxSlides)

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await doc.getPage(pageNumber)
    try {
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement("canvas")
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const context = canvas.getContext("2d")
      if (!context) {
        throw new Error("Could not get a 2D canvas context for slide rendering.")
      }
      await page.render({ canvas, canvasContext: context, viewport }).promise
      slides.push({
        index: pageNumber - 1,
        dataUrl: canvas.toDataURL("image/png"),
        width: canvas.width,
        height: canvas.height,
      })
    } finally {
      page.cleanup()
    }
  }

  return slides
}

/**
 * Render a base64-encoded PDF to ordered slide image data URLs.
 *
 * Requires a DOM (runs in the Tauri webview); pdfjs-dist is imported
 * dynamically the first time this is called.
 */
export async function renderPdfToSlides(
  pdfBase64: string,
  options: RenderPdfOptions = {}
): Promise<RenderedSlide[]> {
  const scale = options.scale ?? DEFAULT_SCALE
  const maxSlides = options.maxSlides ?? DEFAULT_MAX_SLIDES
  const pdfjs = await loadPdfjs()
  const loadingTask = pdfjs.getDocument({ data: base64ToBytes(pdfBase64) })
  const doc = await loadingTask.promise
  try {
    return await renderDocument(doc, scale, maxSlides)
  } finally {
    await doc.destroy()
  }
}
