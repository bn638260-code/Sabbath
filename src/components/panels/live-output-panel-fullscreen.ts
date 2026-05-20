export function isPanelFullscreen(
  panel: Element | null,
  fullscreenElement: Element | null,
): boolean {
  return panel !== null && fullscreenElement === panel
}

export async function togglePanelFullscreen(
  panel: HTMLElement | null,
  fullscreenElement: Element | null,
  exitFullscreen: () => Promise<void>,
): Promise<void> {
  if (!panel) return

  if (isPanelFullscreen(panel, fullscreenElement)) {
    await exitFullscreen()
    return
  }

  await panel.requestFullscreen()
}

