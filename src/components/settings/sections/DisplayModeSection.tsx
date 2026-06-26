import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { useSettingsStore } from "@/stores/settings-store"

export function DisplayModeSection() {
  const {
    autoMode,
    setAutoMode,
    confidenceThreshold,
    setConfidenceThreshold,
    semanticConfidenceThreshold,
    setSemanticConfidenceThreshold,
  } = useSettingsStore()

  const thresholdPercent = Math.round(confidenceThreshold * 100)
  const semanticThresholdPercent = Math.round(semanticConfidenceThreshold * 100)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Broadcast Mode
        </label>

        <RadioGroup
          value={autoMode ? "auto" : "manual"}
          onValueChange={(v) => setAutoMode(v === "auto")}
          className="gap-3"
        >
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20 ${
              !autoMode ? "hover:border-muted-foreground/25" : ""
            }`}
          >
            <RadioGroupItem value="auto" className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Auto</span>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
                Automatically displays the highest-confidence detected verse on
                broadcast output. A 2.5-second cooldown prevents rapid
                flickering. Best for hands-off operation.
              </p>
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20 ${
              autoMode ? "hover:border-muted-foreground/25" : ""
            }`}
          >
            <RadioGroupItem value="manual" className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">
                Manual
              </span>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
                Nothing goes to broadcast until you explicitly send it. Detected
                verses still appear in the AI Detections panel and queue, but
                you decide which ones to display and when. Best for important
                services.
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Semantic detection
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {semanticThresholdPercent}%
          </span>
        </div>
        <Slider
          min={35}
          max={100}
          step={1}
          value={[semanticThresholdPercent]}
          onValueChange={([v]) => setSemanticConfidenceThreshold(v / 100)}
        />
        <p className="text-[0.625rem] text-muted-foreground">
          Semantic verse suggestions below this confidence stay hidden.
        </p>
      </div>

      {autoMode && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Auto-live
            </label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {thresholdPercent}%
            </span>
          </div>
          <Slider
            min={35}
            max={100}
            step={1}
            value={[thresholdPercent]}
            onValueChange={([v]) => setConfidenceThreshold(v / 100)}
          />
          <p className="text-[0.625rem] text-muted-foreground">
            Only detections at or above this confidence are sent live
            automatically.
          </p>
          <p className="text-[0.625rem] font-medium text-foreground">
            Tip: 85% balances hands-free output with review for uncertain
            suggestions.
          </p>
        </div>
      )}
    </div>
  )
}
