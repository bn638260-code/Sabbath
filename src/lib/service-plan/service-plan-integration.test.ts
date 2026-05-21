import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
}

describe("service plan shell integration", () => {
  it("mounts the planner dialog from the dashboard shell", () => {
    const dashboard = readSource("src/components/layout/dashboard.tsx")
    expect(dashboard).toContain("LazyServicePlanDialog")
    expect(dashboard).toContain("LazyServicePlanLibraryPanel")
    expect(dashboard).toContain('"service-plan"')
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

  it("wires Live Control to ServiceContext via ServiceLiveContextPanel", () => {
    const liveOutput = readSource("src/components/panels/live-output-panel.tsx")
    expect(liveOutput).toContain("ServiceLiveContextPanel")
    expect(liveOutput).not.toContain("activePlan")

    const panel = readSource("src/components/service-plan/ServiceLiveContextPanel.tsx")
    expect(panel).toContain("serviceContext")
    expect(panel).not.toContain("activePlan")
  })

  it("opens the planner from the transport bar", () => {
    const transport = readSource("src/components/controls/transport-bar.tsx")
    expect(transport).toContain("openPlanner")
    expect(transport).toContain("Service Plan")
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
