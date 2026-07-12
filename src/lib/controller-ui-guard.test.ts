import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { TUTORIAL_STEPS } from "@/components/tutorial/tutorial-steps"
import {
  BANNED_SURFACE_TOKEN,
  isPrimitiveOwnedLine,
  listControllerWorkspaceFiles,
  scanBannedSurfaceTokens,
  scanLegacyControllerClasses,
  scanLegacyDialogCss,
  scanMixedOuterShell,
  scanNativeFormSurfaceTokens,
} from "./controller-ui-guard"

const REPO_ROOT = join(import.meta.dirname, "../..")

const TUTORIAL_DATA_TOUR_IDS = [
  "book-search",
  "context-search",
  "quick-nav",
  "broadcast",
  "broadcast-output-main",
  "broadcast-monitor-main",
  "broadcast-output-alt",
  "theme",
  "settings",
  "settings-section-audio",
  "settings-section-speech",
  "settings-section-bible",
  "settings-section-display",
  "settings-section-broadcast",
  "projector-setup",
  "settings-section-themes",
  "settings-section-remote",
  "settings-section-api-keys",
  "settings-section-account",
  "settings-section-help",
] as const

const TUTORIAL_DATA_SLOTS = [
  "transcript-panel",
  "detections-panel",
  "queue-panel",
  "preview-panel",
  "live-output-panel",
] as const

describe("controller UI guard — Proof A (mixed outer shell)", () => {
  it("has no glass-panel + rounded-2xl/border-border/bg-card stacks in controller workspaces", () => {
    const violations = scanMixedOuterShell(REPO_ROOT)
    expect(violations).toEqual([])
  })
})

describe("controller UI guard - light mode regression", () => {
  it("has no hard-coded dark-mode utility colors in controller components", () => {
    const bannedUtility =
      /bg-white\/[0-9]|text-white|bg-black\/[0-9]|bg-\[#|text-\[#|border-\[rgba|border-white|ring-white|hover:bg-white|bg-slate-9|text-slate-[1-5]/
    const violations: string[] = []

    for (const file of listControllerWorkspaceFiles(REPO_ROOT)) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8")
      if (bannedUtility.test(content)) violations.push(file)
    }

    expect(violations).toEqual([])
  })

  it("keeps broadcast output on a dark shell independent of controller mode", () => {
    const broadcastOutput = readFileSync(
      join(REPO_ROOT, "src/broadcast-output.tsx"),
      "utf8"
    )

    expect(broadcastOutput).toMatch(
      /root\.className = `dark \$\{accentThemeClassName\(theme\)\}`/
    )
    expect(broadcastOutput).toMatch(/background: "#000"/)
    expect(broadcastOutput).not.toMatch(/useColorModeStore/)
  })
})

describe("controller UI guard — Proof B (banned surface tokens)", () => {
  it("has no banned shadcn surface tokens outside primitive-owned lines", () => {
    const violations = scanBannedSurfaceTokens(REPO_ROOT)
    expect(violations).toEqual([])
  })

  it("scans the expected controller workspace file set", () => {
    const files = listControllerWorkspaceFiles(REPO_ROOT)
    expect(files).toContain("src/components/panels/search-panel.tsx")
    expect(files).toContain("src/components/tutorial/tutorial-tooltip.tsx")
    expect(files).not.toContain("src/components/broadcast/theme-designer.tsx")
    expect(files.some((f) => f.startsWith("src/components/ui/"))).toBe(false)
  })

  it("does not allowlist native textarea/select shadcn classes", () => {
    expect(
      isPrimitiveOwnedLine(
        'className="min-h-0 flex-1 border border-input bg-background p-3"'
      )
    ).toBe(false)
    expect(
      isPrimitiveOwnedLine(
        'className="h-9 w-full border border-input bg-background px-3 text-sm"'
      )
    ).toBe(false)
    expect(scanNativeFormSurfaceTokens(REPO_ROOT)).toEqual([])
  })

  it("detects banned tokens on native form class strings the allowlist no longer exempts", () => {
    const legacyTextarea =
      'className="min-h-0 flex-1 resize-none rounded-md border border-input bg-background p-3"'
    const legacySelect =
      'className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"'

    expect(isPrimitiveOwnedLine(legacyTextarea)).toBe(false)
    expect(isPrimitiveOwnedLine(legacySelect)).toBe(false)
    expect(BANNED_SURFACE_TOKEN.test(legacyTextarea)).toBe(true)
    expect(BANNED_SURFACE_TOKEN.test(legacySelect)).toBe(true)
  })
})

function sourceDefinesDataTour(sources: string, id: string): boolean {
  if (sources.includes(`data-tour="${id}"`)) return true
  // Anchors forwarded through a component prop, e.g. dataTour/monitorDataTour
  // on BroadcastOutputCard.
  if (new RegExp(`[dD]ataTour="${id}"`).test(sources)) return true
  return new RegExp(`data-tour=\\{[\\s\\S]*?["']${id}["']`).test(sources)
}

describe("controller UI guard — tutorial targets", () => {
  it("reminds users that Deepgram and Soniox need paid provider API keys", () => {
    const step = TUTORIAL_STEPS.find((item) => item.title === "Cloud API keys")
    const content = String(step?.content ?? "")

    expect(step?.target).toBe('[data-tour="settings-section-speech"]')
    expect(content).toContain("Deepgram")
    expect(content).toContain("Soniox")
    expect(content).toContain("paid")
    expect(content).toContain("not free")
    expect(content).toContain("generate an API key")
    expect(content).toContain("Settings > Speech Recognition")
    expect(content).toContain("press Save")
    expect(content).toContain("Vosk is local")
  })

  it("includes guided projector setup in the tour", () => {
    const step = TUTORIAL_STEPS.find((item) => item.title === "Projector Setup")
    const content = String(step?.content ?? "")

    expect(step?.target).toBe('[data-tour="projector-setup"]')
    expect(content).toContain("goes live in one tap")
    expect(content).toContain("Win+P")
    expect(content).toContain("Extend")
  })

  it("includes the advanced HDMI broadcast settings step in the guided tour", () => {
    const step = TUTORIAL_STEPS.find(
      (item) => item.title === "HDMI Projector Setup"
    )
    const content = String(step?.content ?? "")

    expect(step?.target).toBe('[data-tour="settings-section-broadcast"]')
    expect(content).toContain("Projector Setup in the top bar")
    expect(content).toContain("Windows display mode to Extend")
    expect(content).toContain("Refresh displays")
    expect(content).toContain("fullscreen projector output")
  })

  it("walks the broadcast output cards in the guided tour", () => {
    const main = TUTORIAL_STEPS.find((item) => item.title === "Main Output")
    expect(main?.target).toBe('[data-tour="broadcast-output-main"]')
    expect(String(main?.content)).toContain("start Off")

    const monitor = TUTORIAL_STEPS.find(
      (item) => item.title === "Target Monitor"
    )
    expect(monitor?.target).toBe('[data-tour="broadcast-monitor-main"]')
    expect(String(monitor?.content)).toContain("Refresh")

    const alt = TUTORIAL_STEPS.find((item) => item.title === "Alternate Output")
    expect(alt?.target).toBe('[data-tour="broadcast-output-alt"]')
  })

  it("explains the account cancellation workflow and disclaimer", () => {
    const step = TUTORIAL_STEPS.find((item) => item.title === "Your Account")
    const content = String(step?.content ?? "")

    expect(step?.target).toBe('[data-tour="settings-section-account"]')
    expect(content).toContain("request subscription cancellation")
    expect(content).toContain("no refund")
    expect(content).toContain("subscribed period ends")
    expect(content).toContain("disables unless renewed")
  })

  it("maps every TUTORIAL_STEPS target to a data-tour or data-slot anchor in source", () => {
    const layoutAndPanelSources = [
      "src/components/layout/workspace-top-nav.tsx",
      "src/components/layout/app-controller-header.tsx",
      "src/components/panels/transcript-panel.tsx",
      "src/components/panels/detections-panel.tsx",
      "src/components/panels/queue-panel.tsx",
      "src/components/panels/preview-panel.tsx",
      "src/components/panels/live-output-panel.tsx",
      "src/components/panels/search-panel.tsx",
      "src/components/settings-dialog.tsx",
    ]
    const sources = [
      ...new Set([
        ...listControllerWorkspaceFiles(REPO_ROOT),
        ...layoutAndPanelSources,
      ]),
    ]
      .map((file) => readFileSync(join(REPO_ROOT, file), "utf8"))
      .join("\n")

    for (const step of TUTORIAL_STEPS) {
      const target = typeof step.target === "string" ? step.target : ""
      const tourMatch = target.match(/data-tour="([^"]+)"/)
      const slotMatch = target.match(/data-slot="([^"]+)"/)

      if (tourMatch) {
        const id = tourMatch[1]
        expect(
          sourceDefinesDataTour(sources, id),
          `missing data-tour anchor for "${id}" (step "${step.title}")`
        ).toBe(true)
        expect(TUTORIAL_DATA_TOUR_IDS as readonly string[]).toContain(id)
      } else if (slotMatch) {
        const id = slotMatch[1]
        expect(
          sources,
          `missing data-slot="${id}" for step "${step.title}"`
        ).toContain(`data-slot="${id}"`)
        expect(TUTORIAL_DATA_SLOTS as readonly string[]).toContain(id)
      } else if (target !== "body") {
        // "body" is react-joyride's centered-modal target and always exists.
        throw new Error(`Unrecognized tutorial target: ${target}`)
      }
    }
  })
})

describe("controller UI guard — dark shell boot", () => {
  it("does not wrap the app in ThemeProvider and forces dark shell before render", () => {
    const main = readFileSync(join(REPO_ROOT, "src/main.tsx"), "utf8")
    expect(main).not.toMatch(/ThemeProvider/)
    expect(main).toMatch(/hydrateControllerColorMode/)
    expect(main).toMatch(/useColorModeStore\.getState\(\)\.hydrate\(\)/)
    expect(main).not.toMatch(/classList\.remove\("light"\)/)
    expect(main).not.toMatch(/classList\.add\("dark"\)/)
  })

  it("has no controller component imports of useTheme", () => {
    const violations: string[] = []
    for (const file of listControllerWorkspaceFiles(REPO_ROOT)) {
      const content = readFileSync(join(REPO_ROOT, file), "utf8")
      if (/useTheme/.test(content)) violations.push(file)
    }
    expect(violations).toEqual([])
  })
})

describe("controller UI guard — legacy classes and dialog CSS", () => {
  it("has no legacy controller classes in workspace files", () => {
    expect(scanLegacyControllerClasses(REPO_ROOT)).toEqual([])
  })

  it("has no legacy .dark dialog rules in index.css", () => {
    expect(scanLegacyDialogCss(REPO_ROOT)).toEqual([])
  })

  it("styles dialog and toaster with reference glass in components", () => {
    const dialog = readFileSync(
      join(REPO_ROOT, "src/components/ui/dialog.tsx"),
      "utf8"
    )
    const app = readFileSync(join(REPO_ROOT, "src/App.tsx"), "utf8")
    expect(dialog).toMatch(/border-\[var\(--border-subtle\)\]/)
    expect(dialog).toMatch(
      /linear-gradient\(145deg,var\(--bg-surface\),var\(--bg-elevated\)\)/
    )
    expect(app).toMatch(/<Toaster/)
    expect(app).toMatch(/glass-panel/)
    expect(app).toMatch(/theme=\{colorMode\}/)
  })
})
