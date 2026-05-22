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
    expect(dashboard).toContain("Service Plans")
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

    const panel = readSource("src/components/service-plan/ServiceLiveContextPanel.tsx")
    expect(panel).toContain("serviceContext")
    expect(panel).not.toContain("activePlan")
  })

  it("opens the planner from the transport bar", () => {
    const transport = readSource("src/components/controls/transport-bar.tsx")
    expect(transport).toContain("openPlanner")
    expect(transport).toContain("Service Plan")
  })

  it("validates service plan attachments through the backend command", () => {
    const editor = readSource("src/components/service-plan/MediaAttachmentsEditor.tsx")
    expect(editor).not.toContain("@tauri-apps/plugin-fs")
    expect(editor).toContain("validate_service_attachment_path")
    expect(editor).toContain("invokeTauri")
    expect(editor).toContain("sizeBytes")
  })

  it("implements attachment validation in the Tauri assets command", () => {
    const assets = readSource("src-tauri/src/commands/assets.rs")
    expect(assets).toContain("validate_service_attachment_path")
    expect(assets).toContain("ServiceAttachmentValidation")
    expect(assets).toContain("MAX_SLIDE_SIZE_BYTES")
    expect(assets).toContain("MAX_MEDIA_SIZE_BYTES")
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
  })
})
