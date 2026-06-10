/**
 * Fullscreen for the live output panel.
 *
 * Uses Tauri window fullscreen + a fixed overlay layout instead of the HTML5
 * Fullscreen API. WebView2's element-fullscreen transition swaps compositor
 * surfaces, which produces an unavoidable flash/glitch on enter and exit; a
 * window-level fullscreen with the panel pinned over the whole webview does
 * not.
 */

export interface FullscreenWindowController {
  setFullscreen(fullscreen: boolean): Promise<void>
}

/** Default controller: drives the current Tauri window. */
export async function tauriWindowFullscreen(fullscreen: boolean): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window")
  await getCurrentWindow().setFullscreen(fullscreen)
}

/**
 * Apply the fullscreen layout optimistically, then drive the window. The
 * layout flips before the async window call so the panel never paints a
 * frame of windowed chrome at fullscreen size. Rolls back if the window
 * call fails.
 */
export async function applyPanelFullscreen(
  fullscreen: boolean,
  controller: FullscreenWindowController,
  onLayoutChange: (fullscreen: boolean) => void,
): Promise<void> {
  onLayoutChange(fullscreen)
  try {
    await controller.setFullscreen(fullscreen)
  } catch (error) {
    onLayoutChange(!fullscreen)
    throw error
  }
}
