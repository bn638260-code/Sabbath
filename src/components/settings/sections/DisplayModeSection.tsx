import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useSettingsStore } from "@/stores/settings-store"

export function DisplayModeSection() {
  const {
    autoMode,
    setAutoMode,
    confidenceThreshold,
    setConfidenceThreshold,
    semanticDetectionEnabled,
    setSemanticDetectionEnabled,
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
                Automatically displays the strongest detected verse on
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
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Semantic detection
            </label>
            <p className="text-[0.625rem] text-muted-foreground">
              Allow paraphrase and quote-based Bible suggestions.
            </p>
          </div>
          <Switch
            aria-label="Semantic detection"
            checked={semanticDetectionEnabled}
            onCheckedChange={setSemanticDetectionEnabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Semantic match strength
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {semanticDetectionEnabled ? `${semanticThresholdPercent}%` : "Off"}
          </span>
        </div>
        <Slider
          min={35}
          max={100}
          step={1}
          value={[semanticThresholdPercent]}
          disabled={!semanticDetectionEnabled}
          onValueChange={([v]) => setSemanticConfidenceThreshold(v / 100)}
        />
        <p className="text-[0.625rem] text-muted-foreground">
          {semanticDetectionEnabled
            ? "Semantic verse suggestions below this match strength stay hidden."
            : "Only direct spoken references will appear in detections."}
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
            Only detections at or above this match strength are sent live
            automatically.
          </p>
          <p className="text-[0.625rem] font-medium text-foreground">
            Tip: 90% is the validated safety setting for hands-free output.
          </p>
        </div>
      )}
    </div>
  )
}
