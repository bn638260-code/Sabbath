import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { PanelHeader } from "@/components/ui/panel-header"
import { SERVICE_PLAN_TEMPLATES } from "@/lib/service-plan/service-plan-templates"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { ClipboardListIcon } from "lucide-react"
import { ServicePlanSummaryWidget } from "./ServicePlanSummaryWidget"

export function ServicePlanLibraryPanel() {
  const createFromTemplate = useServicePlanStore((s) => s.createFromTemplate)
  const hydrate = useServicePlanStore((s) => s.hydrate)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  return (
    <div
      className="glass-panel relative flex min-h-0 flex-col overflow-hidden"
      data-slot="service-plan-page"
    >
      <div className="space-y-4 overflow-y-auto p-4">
        <PanelHeader
          title="Service Plan"
          icon={<ClipboardListIcon className="size-4" />}
        />
        <ServicePlanSummaryWidget />
        <div className="grid gap-3">
          {SERVICE_PLAN_TEMPLATES.map((template) => (
            <Button
              key={template.id}
              variant="outline"
              size="sm"
              className="h-auto justify-start py-2 text-left"
              onClick={() => void createFromTemplate(template.id)}
            >
              <div>
                <div className="text-xs font-medium">{template.label}</div>
                <div className="text-[0.625rem] text-muted-foreground">
                  {template.description}
                </div>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
