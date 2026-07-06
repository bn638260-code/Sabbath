import { useBroadcastDesignerStore as useBroadcastStore } from "@/stores/broadcast/designer-store"
import { BUILTIN_THEMES } from "@/lib/builtin-themes"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const QUICK_FONTS = [
  { label: "Jakarta", family: "Plus Jakarta Sans Variable" },
  { label: "Outfit", family: "Outfit Variable" },
  { label: "Playfair", family: "Playfair Display" },
  { label: "Geist", family: "Geist Variable" },
  { label: "Serif", family: "Source Serif 4 Variable" },
] as const

const PURE_CLASSIC_HYMN = BUILTIN_THEMES.find(
  (t) => t.id === "builtin-hymn-sanctuary-solid",
)

export function LayoutProperties() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)
  const updateDraft = useBroadcastStore((s) => s.updateDraft)

  if (!draftTheme) return null

  const layout = draftTheme.layout
  const resolution = draftTheme.resolution
  const referenceGap = layout.referenceGap ?? Math.max(16, Math.round(draftTheme.reference.fontSize * 0.5))

  const bgWidthPx = Math.round((layout.backgroundWidth / 100) * resolution.width)
  const bgHeightPx = Math.round((layout.backgroundHeight / 100) * resolution.height)
  const textWidthPx = Math.round((layout.textAreaWidth / 100) * resolution.width)
  const textHeightPx = Math.round((layout.textAreaHeight / 100) * resolution.height)

  const verseNumbers = draftTheme.verseNumbers
  const hymnPresentation = draftTheme.hymnPresentation ?? {}
  const slideCounter = hymnPresentation.slideCounter ?? {}
  const superscriptSizePct = Math.round(
    (verseNumbers.fontSize / draftTheme.verseText.fontSize) * 100
  )

  const activeQuickFont =
    draftTheme.verseText.fontFamily === draftTheme.reference.fontFamily
      ? draftTheme.verseText.fontFamily
      : null

  function applyQuickFont(fontFamily: string) {
    updateDraft({
      verseText: { ...draftTheme.verseText, fontFamily },
      reference: { ...draftTheme.reference, fontFamily },
    })
  }

  function applyPureClassicHymnLayout() {
    if (!PURE_CLASSIC_HYMN) return
    updateDraft({
      hymnPresentation: PURE_CLASSIC_HYMN.hymnPresentation,
      layout: { ...PURE_CLASSIC_HYMN.layout },
      reference: {
        ...draftTheme.reference,
        position: PURE_CLASSIC_HYMN.reference.position,
        horizontalAlign: PURE_CLASSIC_HYMN.reference.horizontalAlign,
        verticalAlign: PURE_CLASSIC_HYMN.reference.verticalAlign,
      },
      verseNumbers: {
        ...draftTheme.verseNumbers,
        visible: PURE_CLASSIC_HYMN.verseNumbers.visible,
      },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Background Dimensions */}
      <div className="flex flex-col gap-0.5 pb-1">
        <h4 className="text-xs font-semibold">Background Dimensions</h4>
      </div>

      {/* Width */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Width</label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {layout.backgroundWidth}% ({bgWidthPx}px)
          </span>
        </div>
        <Slider
          min={10}
          max={100}
          step={1}
          value={[layout.backgroundWidth]}
          onValueChange={([v]) => update("layout.backgroundWidth", v)}
        />
      </div>

      {/* Height */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Height</label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {layout.backgroundHeight}% ({bgHeightPx}px)
          </span>
        </div>
        <Slider
          min={10}
          max={100}
          step={1}
          value={[layout.backgroundHeight]}
          onValueChange={([v]) => update("layout.backgroundHeight", v)}
        />
      </div>

      {/* Text Area Dimensions */}
      <div className="flex flex-col gap-0.5 border-t pt-3 pb-1">
        <h4 className="text-xs font-semibold">Text Area Dimensions</h4>
      </div>

      {/* Text Width */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Text Width</label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {layout.textAreaWidth}% ({textWidthPx}px)
          </span>
        </div>
        <Slider
          min={10}
          max={100}
          step={1}
          value={[layout.textAreaWidth]}
          onValueChange={([v]) => update("layout.textAreaWidth", v)}
        />
      </div>

      {/* Text Height */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Text Height</label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {layout.textAreaHeight}% ({textHeightPx}px)
          </span>
        </div>
        <Slider
          min={10}
          max={100}
          step={1}
          value={[layout.textAreaHeight]}
          onValueChange={([v]) => update("layout.textAreaHeight", v)}
        />
      </div>

      {/* Padding */}
      <div className="flex flex-col gap-0.5 border-t pt-3 pb-1">
        <h4 className="text-xs font-semibold">Padding</h4>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Top</label>
          <Input
            type="number"
            min={0}
            value={layout.padding.top}
            onChange={(e) => update("layout.padding.top", Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Right</label>
          <Input
            type="number"
            min={0}
            value={layout.padding.right}
            onChange={(e) => update("layout.padding.right", Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Bottom</label>
          <Input
            type="number"
            min={0}
            value={layout.padding.bottom}
            onChange={(e) => update("layout.padding.bottom", Number(e.target.value))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Left</label>
          <Input
            type="number"
            min={0}
            value={layout.padding.left}
            onChange={(e) => update("layout.padding.left", Number(e.target.value))}
          />
        </div>
      </div>

      {/* Element Spacing */}
      <div className="flex flex-col gap-0.5 border-t pt-3 pb-1">
        <h4 className="text-xs font-semibold">Element Spacing</h4>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Verse / Reference</label>
          <span className="text-xs tabular-nums text-muted-foreground">{referenceGap}px</span>
        </div>
        <Slider
          min={0}
          max={200}
          step={1}
          value={[referenceGap]}
          onValueChange={([v]) => update("layout.referenceGap", v)}
        />
      </div>

      {/* Display Options */}
      <div className="flex flex-col gap-0.5 border-t pt-3 pb-1">
        <h4 className="text-xs font-semibold">Display Options</h4>
      </div>

      {/* Reference Position */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Reference Position</label>
        <Select
          value={draftTheme.reference.position}
          onValueChange={(v) => update("reference.position", v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="above">Above Verse</SelectItem>
            <SelectItem value="below">Below Verse</SelectItem>
            <SelectItem value="inline">Inline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Verse Number Superscript */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">Verse Number Superscript</label>
        <input
          type="checkbox"
          checked={verseNumbers.superscript}
          onChange={(e) => update("verseNumbers.superscript", e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
      </div>

      {/* Superscript Size */}
      {verseNumbers.superscript && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Superscript Size</label>
            <span className="text-xs tabular-nums text-muted-foreground">{superscriptSizePct}%</span>
          </div>
          <Slider
            min={20}
            max={100}
            step={1}
            value={[superscriptSizePct]}
            onValueChange={([v]) => {
              const newFontSize = Math.round((v / 100) * draftTheme.verseText.fontSize)
              update("verseNumbers.fontSize", newFontSize)
            }}
          />
        </div>
      )}

      {/* Hymn layout (adoptable on any theme) */}
      <div className="flex flex-col gap-0.5 border-t pt-3 pb-1">
        <h4 className="text-xs font-semibold">Hymn Layout</h4>
        <p className="text-[11px] text-muted-foreground">
          Quick fonts apply to both the title and lyrics. Layout keeps each
          theme&apos;s colors and background.
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full"
        disabled={!PURE_CLASSIC_HYMN}
        onClick={applyPureClassicHymnLayout}
      >
        Apply Pure Classic hymn layout
      </Button>

      <div className="flex flex-wrap gap-1.5">
        {QUICK_FONTS.map(({ label, family }) => (
          <Button
            key={family}
            type="button"
            size="xs"
            variant={activeQuickFont === family ? "default" : "outline"}
            className={cn("min-w-[4.5rem]")}
            style={{ fontFamily: `"${family}", sans-serif` }}
            onClick={() => applyQuickFont(family)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">Title only (hide verse label)</label>
        <input
          type="checkbox"
          checked={hymnPresentation.titleOnly ?? false}
          onChange={(e) =>
            update("hymnPresentation.titleOnly", e.target.checked)
          }
          className="h-4 w-4 rounded border-input accent-primary"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Slide counter position</label>
        <Select
          value={slideCounter.position ?? "top-right"}
          onValueChange={(v) =>
            update("hymnPresentation.slideCounter.position", v)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="top-right">Top right (badge)</SelectItem>
            <SelectItem value="bottom-right">Bottom right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Slide counter format</label>
        <Select
          value={slideCounter.format ?? "of"}
          onValueChange={(v) => update("hymnPresentation.slideCounter.format", v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="of">2 of 4</SelectItem>
            <SelectItem value="slash">2/4</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(slideCounter.position ?? "top-right") === "bottom-right" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Slide counter style</label>
          <Select
            value={slideCounter.style ?? "plain"}
            onValueChange={(v) => update("hymnPresentation.slideCounter.style", v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="plain">Plain text</SelectItem>
              <SelectItem value="badge">Badge</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
