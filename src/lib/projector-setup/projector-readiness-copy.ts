import type { ProjectorReadiness } from "./projector-readiness"

export type ProjectorChipTone = "live" | "ready" | "warn" | "neutral"

/**
 * What the primary panel button should do for a given readiness state.
 *   - `restore`               → apply the remembered/external screen and go live
 *   - `hide`                  → take the projector output off air
 *   - `open-display-settings` → open Windows display settings (mirror/Extend fix)
 *   - `none`                  → nothing actionable yet (waiting for a projector)
 */
export type ProjectorPrimaryKind =
  | "restore"
  | "hide"
  | "open-display-settings"
  | "none"

export interface ProjectorReadinessCopy {
  chipLabel: string
  chipTone: ProjectorChipTone
  title: string
  body: string
  primaryLabel: string
  primaryKind: ProjectorPrimaryKind
}

const COPY: Record<ProjectorReadiness, ProjectorReadinessCopy> = {
  live: {
    chipLabel: "On air",
    chipTone: "live",
    title: "Projector is on air",
    body: "Presented verses are showing on the projector.",
    primaryLabel: "Hide projector",
    primaryKind: "hide",
  },
  "ready-standby": {
    chipLabel: "Projector ready",
    chipTone: "ready",
    title: "Ready — same as last time",
    body: "Your usual projector is connected. Go live whenever you're ready.",
    primaryLabel: "Go live on the projector",
    primaryKind: "restore",
  },
  "setup-changed": {
    chipLabel: "Check projector",
    chipTone: "warn",
    title: "A different screen is connected",
    body: "Last week's screen isn't here, but another display is. Use it instead?",
    primaryLabel: "Use this screen",
    primaryKind: "restore",
  },
  "possibly-duplicate-mode": {
    chipLabel: "Fix projector",
    chipTone: "warn",
    title: "Your screens may be mirrored",
    body: "The projector may be showing the same thing as your main screen. Press Win+P and choose Extend.",
    primaryLabel: "Open Windows display settings",
    primaryKind: "open-display-settings",
  },
  "projector-not-detected": {
    chipLabel: "Set up projector",
    chipTone: "warn",
    title: "No projector found",
    body: "Connect the projector's HDMI cable. If it's already connected, press Win+P and choose Extend.",
    primaryLabel: "Waiting for projector…",
    primaryKind: "none",
  },
  "no-remembered-setup": {
    chipLabel: "Set up projector",
    chipTone: "neutral",
    title: "Let's set up your projector",
    body: "Connect the projector, confirm its screen below, then go live.",
    primaryLabel: "Go live on the projector",
    primaryKind: "restore",
  },
}

export function projectorReadinessCopy(
  readiness: ProjectorReadiness,
): ProjectorReadinessCopy {
  return COPY[readiness]
}
