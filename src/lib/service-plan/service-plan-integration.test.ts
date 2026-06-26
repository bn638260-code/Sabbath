import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

describe("service plan shell integration", () => {
  it("mounts the service plan workspace from the dashboard shell", () => {
    const dashboard = readSource("src/components/layout/dashboard.tsx")
    expect(dashboard).toContain("LazyServicePlanWorkspace")
    expect(dashboard).toContain(
      'import("@/components/service-plan/ServicePlanWorkspace")',
    )
    const nav = readSource("src/lib/dashboard-workspace-nav.ts")
    expect(nav).toContain("Service Schedules")
    expect(dashboard).not.toContain("LazyServicePlanDialog")
  })

  it("hydrates service plans during app boot", () => {
    const main = readSource("src/main.tsx")
    expect(main).toContain("hydrateServicePlans")
  })

  it("exposes service plan store from the stores barrel", () => {
    const stores = readSource("src/stores/index.ts")
    expect(stores).toContain("useServicePlanStore")
    expect(stores).toContain("getServiceContext")
  })

  it("exports service plan types from the types barrel", () => {
    const types = readSource("src/types/index.ts")
    expect(types).toContain("ServiceContext")
    expect(types).toContain("ServicePlanReport")
  })

  it("keeps service context panel on dedicated service screens, not the normal live output", () => {
    const liveOutput = readSource("src/components/panels/live-output-panel.tsx")
    expect(liveOutput).not.toContain("ServiceLiveContextPanel")

    const panel = readSource(
      "src/components/service-plan/ServiceLiveContextPanel.tsx"
    )
    expect(panel).toContain("serviceContext")
    expect(panel).not.toContain("activePlan")

    const runService = readSource("src/components/service-plan/RunServicePage.tsx")
    expect(runService).toContain("ServiceLiveContextPanel")
    const servicePlanShell = readSource(
      "src/components/service-plan/ServicePlanPage.tsx",
    )
    expect(servicePlanShell).toContain("RunServicePage")
  })

  it("opens the planner from the workspace top navigation", () => {
    const topNav = readSource("src/components/layout/workspace-top-nav.tsx")
    expect(topNav).toContain("openPlanner")
    expect(topNav).toContain("service-plans")
  })

  it("validates service plan attachments through the backend command", () => {
    const editor = readSource(
      "src/components/service-plan/MediaAttachmentsEditor.tsx"
    )
    expect(editor).not.toContain("@tauri-apps/plugin-fs")
    expect(editor).toContain("validate_service_attachment_path")
    expect(editor).toContain("invokeTauri")
    expect(editor).toContain("sizeBytes")
  })

  it("offers PNG sermon slides directly from the service-plan item editor", () => {
    const details = readSource(
      "src/components/service-plan/ServiceItemDetailsPanel.tsx"
    )
    const slides = readSource(
      "src/components/service-plan/SermonSlidesEditor.tsx"
    )

    expect(details).toContain("<SermonSlidesEditor")
    expect(details).toContain("Sermon slides")
    expect(details).toContain("Attachments and documents")
    expect(slides).toContain('"png"')
    expect(slides).toContain("Upload PNG / images")
  })

  it("implements attachment validation in the Tauri assets command", () => {
    const assets = readSource("src-tauri/src/commands/assets.rs")
    expect(assets).toContain("validate_service_attachment_path")
    expect(assets).toContain("ServiceAttachmentValidation")
    expect(assets).toContain("MAX_SLIDE_SIZE_BYTES")
    expect(assets).toContain("MAX_MEDIA_SIZE_BYTES")
    expect(assets).toContain("get_service_attachment_limits")
  })

  it("mounts the run service workspace from the dashboard shell", () => {
    const dashboard = readSource("src/components/layout/dashboard.tsx")
    expect(dashboard).toContain("LazyRunServicePage")
    const nav = readSource("src/lib/dashboard-workspace-nav.ts")
    expect(nav).toContain("Run Service Flow")
  })

  it("uses backend-derived attachment limit copy in sermon slide uploads", () => {
    const slides = readSource("src/components/service-plan/SermonSlidesEditor.tsx")
    expect(slides).toContain("loadServiceAttachmentLimits")
    expect(slides).toContain("attachmentSizeLimitError")
    expect(slides).not.toContain("smaller than 10 MB")
  })

  it("wires PowerPoint import into the sermon slide editor", () => {
    const slides = readSource("src/components/service-plan/SermonSlidesEditor.tsx")
    expect(slides).toContain("importPowerPointSlides")
    expect(slides).toContain("slidesToAttachments")
    expect(slides).toContain("Import PowerPoint")
    expect(slides).toContain("kept as")
    expect(slides).toContain("because no text was found")

    const helper = readSource("src/lib/powerpoint-import.ts")
    expect(helper).toContain("convert_powerpoint_to_pdf")
    expect(helper).toContain("renderPdfToSlides")
  })

  it("applies a single selected PowerPoint slide as the theme background", () => {
    const background = readSource(
      "src/components/broadcast/background-properties.tsx"
    )
    expect(background).toContain("importPowerPointSlides")
    expect(background).toContain("PowerPointSlidePicker")
    expect(background).toContain('update("background.image.url", slide.dataUrl)')
  })

  it("converts PowerPoint decks through a validated Tauri command", () => {
    const command = readSource("src-tauri/src/commands/powerpoint.rs")
    expect(command).toContain("convert_powerpoint_to_pdf")
    expect(command).toContain("resolve_soffice")
    expect(command).toContain("validate_deck_path")
  })
})

describe("prepare queue resources", () => {
  it("handles scripture, media, slide, and hymn resources with service-plan source", () => {
    const source = readSource("src/lib/service-plan/prepare-queue-resources.ts")
    expect(source).toContain('source: "service-plan"')
    expect(source).toContain("scriptureRefs")
    expect(source).toContain("mediaRefs")
    expect(source).toContain("createMediaPresentation")
    expect(source).toContain('kind: "media"')
    expect(source).toContain("getHymnByNumber")
    expect(source).toContain("createGroupedHymnQueueItems")
  })
})
