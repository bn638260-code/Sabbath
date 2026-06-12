export type KeyboardShortcutGroup = {
  title: string
  shortcuts: Array<{
    keys: string
    action: string
  }>
}

export function getPrimaryShortcutModifier(): "Ctrl" | "Cmd" {
  if (typeof navigator === "undefined") return "Ctrl"

  const platform = navigator.platform.toLowerCase()
  return platform.includes("mac") ? "Cmd" : "Ctrl"
}

export function getShortcutDisplayParts(keys: string): string[] {
  return keys.replaceAll("Ctrl/Cmd", getPrimaryShortcutModifier()).split(" + ")
}

export function formatShortcutLabel(keys: string): string {
  return getShortcutDisplayParts(keys).join(" + ")
}

export const DASHBOARD_KEYBOARD_SHORTCUTS: KeyboardShortcutGroup[] = [
  {
    title: "Workspaces",
    shortcuts: [
      { keys: "Ctrl/Cmd + 1", action: "Live Desk" },
      { keys: "Ctrl/Cmd + 2", action: "Service Schedules" },
      { keys: "Ctrl/Cmd + 3", action: "Run Service Flow" },
      { keys: "Ctrl/Cmd + 4", action: "SDA Hymns Search" },
    ],
  },
  {
    title: "Live Output",
    shortcuts: [
      { keys: "Ctrl/Cmd + Enter", action: "Send preview live" },
      {
        keys: "Ctrl/Cmd + Shift + Enter",
        action: "Present active queue item",
      },
      { keys: "Ctrl/Cmd + Shift + L", action: "Show or hide live output" },
      { keys: "Ctrl/Cmd + Shift + B", action: "Blackout output" },
      { keys: "Ctrl/Cmd + Shift + X", action: "Clear live output" },
      { keys: "Ctrl/Cmd + Shift + P", action: "Clear preview output" },
      {
        keys: "Arrow Left / Right",
        action: "Previous or next slide in the active deck",
      },
    ],
  },
  {
    title: "Operation",
    shortcuts: [
      { keys: "Ctrl/Cmd + M", action: "Start or stop transcription" },
      {
        keys: "Alt + Arrow Up / Down",
        action: "Select previous or next queue item",
      },
      {
        keys: "Alt + Arrow Left / Right",
        action: "Previous or next service item",
      },
    ],
  },
  {
    title: "Tutorial",
    shortcuts: [
      { keys: "Arrow Left / Right", action: "Previous or next tutorial step" },
      { keys: "Esc", action: "Close the tutorial" },
    ],
  },
]
