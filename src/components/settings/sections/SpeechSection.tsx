import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { useAssets } from "@/hooks/use-assets"
import { useDeepgramKeySettings } from "@/hooks/use-deepgram-key-settings"
import { useGladiaKeySettings } from "@/hooks/use-gladia-key-settings"
import { useSettingsStore, type SttProvider } from "@/stores/settings-store"
import { CheckIcon, DownloadIcon, HardDriveIcon, ZapIcon } from "lucide-react"

function ProviderOption({
  value,
  activeProvider,
  title,
  description,
}: {
  value: SttProvider
  activeProvider: SttProvider
  title: string
  description: string
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20 ${
        activeProvider !== value ? "hover:border-muted-foreground/25" : ""
      }`}
    >
      <RadioGroupItem value={value} className="mt-0.5" />
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">{title}</span>
        <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </label>
  )
}

function ProviderSelector({
  sttProvider,
  switchingStt,
  onProviderChange,
}: {
  sttProvider: SttProvider
  switchingStt: boolean
  onProviderChange: (provider: SttProvider) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        Provider
      </label>

      <RadioGroup
        value={sttProvider}
        onValueChange={(v) => onProviderChange(v as SttProvider)}
        disabled={switchingStt}
        className="gap-3"
      >
        <ProviderOption
          value="deepgram"
          activeProvider={sttProvider}
          title="Cloud (Deepgram, optional paid)"
          description="Uses Deepgram Nova-3 for real-time streaming transcription. Requires an API key and internet connection. Best accuracy with keyword boosting for Bible terms."
        />
        <ProviderOption
          value="gladia"
          activeProvider={sttProvider}
          title="Cloud (Gladia)"
          description="Uses Gladia Solaria-1 for real-time streaming transcription. Requires an API key and internet connection. Runs English-only live captions through the same verse detection pipeline."
        />
        <ProviderOption
          value="vosk"
          activeProvider={sttProvider}
          title="Local (Vosk)"
          description="Uses a verse-focused constrained grammar for fast Bible reference detection. Free after the model is installed, and audio never leaves your machine. For full-sermon transcript quality, use Deepgram."
        />
      </RadioGroup>
    </div>
  )
}

function VoskModelStatus({
  assetsLoading,
  voskReady,
  voskModelName,
  voskModelQuality,
  voskMissingMessage,
  hasModel,
  onRefresh,
}: {
  assetsLoading: boolean
  voskReady: boolean
  voskModelName: string | null
  voskModelQuality: string | null
  voskMissingMessage: string | null
  hasModel: boolean
  onRefresh: () => void
}) {
  const badgeText = assetsLoading
    ? "Checking"
    : voskReady
      ? voskModelQuality || "Installed"
      : "Missing"

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HardDriveIcon className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            Local model status
          </span>
        </div>
        <Badge variant="outline" className="text-[0.5rem]">
          {badgeText}
        </Badge>
      </div>

      <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
        Vosk runs with a verse-focused constrained grammar. For better offline
        recognition, install <code className="text-[0.5625rem]">vosk-model-en-us-0.22-lgraph</code>
        . The smaller <code className="text-[0.5625rem]">vosk-model-small-en-us</code>{" "}
        model remains supported as a fallback. Development builds using the
        Python worker also need the <code className="text-[0.5625rem]">vosk</code>{" "}
        package installed. Place the model folder here or set{" "}
        <code className="text-[0.5625rem]">SABBATHCUE_VOSK_MODEL_DIR</code>.
      </p>
      {!assetsLoading && voskModelName ? (
        <p className="rounded-md bg-[var(--shell-code-bg)] px-2 py-1.5 font-mono text-[0.625rem] text-muted-foreground">
          Active model: {voskModelName}
        </p>
      ) : null}
      {!assetsLoading && voskMissingMessage ? (
        <p className="rounded-md bg-[var(--shell-code-bg)] px-2 py-1.5 font-mono text-[0.625rem] text-muted-foreground">
          {voskMissingMessage}
        </p>
      ) : null}
      {!assetsLoading && !hasModel ? (
        <p className="rounded-md bg-[var(--shell-code-bg)] px-2 py-1.5 font-mono text-[0.625rem] text-muted-foreground">
          models\vosk\vosk-model-en-us-0.22-lgraph
        </p>
      ) : null}

      <Button
        size="sm"
        variant="outline"
        onClick={() => void onRefresh()}
        className="w-fit text-xs"
      >
        <DownloadIcon className="size-3" />
        Refresh asset status
      </Button>
    </div>
  )
}

type KeySettings = {
  hasApiKey: boolean
  keyValue: string
  setKeyValue: (value: string) => void
  editingSavedKey: boolean
  setEditingSavedKey: (value: boolean) => void
  saved: boolean
  keyError: string | null
  displayedKeyValue: string
  keyActionLabel: string
  handleKeyAction: () => Promise<void>
  handleClearKey: () => Promise<void>
}

function voskMissingMessageFor(status: ReturnType<typeof useAssets>["status"]): string | null {
  if (status?.vosk_model && status?.vosk_worker && status?.vosk_runtime) return null
  if (!status?.vosk_model) {
    return "Vosk model files are missing from the app resources or configured model path."
  }
  if (!status?.vosk_worker) {
    return "Vosk worker script is missing from the app resources."
  }
  return (
    status?.vosk_runtime_error ||
    "Python is available, but the Vosk package could not be loaded."
  )
}

function deepgramKeyAdapter(settings: ReturnType<typeof useDeepgramKeySettings>): KeySettings {
  return {
    hasApiKey: settings.hasDeepgramApiKey,
    keyValue: settings.keyValue,
    setKeyValue: settings.setKeyValue,
    editingSavedKey: settings.editingSavedKey,
    setEditingSavedKey: settings.setEditingSavedKey,
    saved: settings.saved,
    keyError: settings.keyError,
    displayedKeyValue: settings.displayedKeyValue,
    keyActionLabel: settings.keyActionLabel,
    handleKeyAction: settings.handleKeyAction,
    handleClearKey: settings.handleClearKey,
  }
}

function gladiaKeyAdapter(settings: ReturnType<typeof useGladiaKeySettings>): KeySettings {
  return {
    hasApiKey: settings.hasGladiaApiKey,
    keyValue: settings.keyValue,
    setKeyValue: settings.setKeyValue,
    editingSavedKey: settings.editingSavedKey,
    setEditingSavedKey: settings.setEditingSavedKey,
    saved: settings.saved,
    keyError: settings.keyError,
    displayedKeyValue: settings.displayedKeyValue,
    keyActionLabel: settings.keyActionLabel,
    handleKeyAction: settings.handleKeyAction,
    handleClearKey: settings.handleClearKey,
  }
}

function ProviderKeySettings({
  providerName,
  domain,
  settings,
}: {
  providerName: string
  domain: string
  settings: KeySettings
}) {
  const inputType =
    settings.hasApiKey &&
    !settings.editingSavedKey &&
    !settings.keyValue
      ? "text"
      : "password"

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {providerName} API Key
        </label>
        {settings.hasApiKey ? (
          <Badge variant="outline" className="text-[0.5rem]">
            Key configured
          </Badge>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Input
          type={inputType}
          placeholder={`Enter your ${providerName} API key...`}
          value={settings.displayedKeyValue}
          readOnly={
            settings.hasApiKey &&
            !settings.editingSavedKey &&
            !settings.keyValue
          }
          onChange={(e) => {
            settings.setEditingSavedKey(true)
            settings.setKeyValue(e.target.value)
          }}
          className="flex-1 text-xs"
        />
        <Button size="sm" onClick={() => void settings.handleKeyAction()}>
          {settings.saved ? (
            <>
              <CheckIcon className="size-3" />
              Saved
            </>
          ) : (
            settings.keyActionLabel
          )}
        </Button>
        {settings.hasApiKey ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void settings.handleClearKey()}
          >
            Remove
          </Button>
        ) : null}
      </div>
      {settings.keyError ? (
        <p className="text-[0.625rem] text-red-500">{settings.keyError}</p>
      ) : null}
      <p className="text-[0.625rem] text-muted-foreground">
        Required for live transcription. Get a key at{" "}
        <span className="text-primary">{domain}</span>
      </p>
    </div>
  )
}

function PerformanceSetting({ lowPowerMode }: { lowPowerMode: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        Performance
      </label>
      <label
        data-testid="low-power-mode"
        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3"
      >
        <div className="flex items-start gap-3">
          <ZapIcon className="mt-0.5 size-3.5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground">
              Low power mode
            </span>
            <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
              Reduces CPU and memory use on weaker machines. Paraphrase
              detection runs only on finished sentences instead of live partial
              speech; spoken references like &quot;John 3:16&quot; are still
              detected instantly. Takes effect the next time transcription
              starts.
            </p>
          </div>
        </div>
        <Switch
          checked={lowPowerMode}
          onCheckedChange={(checked) =>
            useSettingsStore.getState().setLowPowerMode(checked)
          }
        />
      </label>
    </div>
  )
}

export function SpeechSection() {
  const lowPowerMode = useSettingsStore((s) => s.lowPowerMode)
  const deepgramKeySettings = useDeepgramKeySettings()
  const {
    sttProvider,
    switchingStt,
    handleProviderChange,
  } = deepgramKeySettings
  const gladiaKeySettings = useGladiaKeySettings(handleProviderChange)

  const {
    status: assetStatus,
    loading: assetsLoading,
    refresh: refreshAssets,
  } = useAssets()

  const voskReady = Boolean(
    assetStatus?.vosk_model &&
    assetStatus?.vosk_worker &&
    assetStatus?.vosk_runtime
  )
  const voskModelName = assetStatus?.vosk_model_name ?? null
  const voskModelQuality = assetStatus?.vosk_model_quality ?? null
  const voskMissingMessage = voskMissingMessageFor(assetStatus)

  return (
    <div className="flex flex-col gap-6">
      <ProviderSelector
        sttProvider={sttProvider}
        switchingStt={switchingStt}
        onProviderChange={handleProviderChange}
      />

      {sttProvider === "vosk" && (
        <VoskModelStatus
          assetsLoading={assetsLoading}
          voskReady={voskReady}
          voskModelName={voskModelName}
          voskModelQuality={voskModelQuality}
          voskMissingMessage={voskMissingMessage}
          hasModel={Boolean(assetStatus?.vosk_model)}
          onRefresh={refreshAssets}
        />
      )}

      {sttProvider === "deepgram" && (
        <ProviderKeySettings
          providerName="Deepgram"
          domain="deepgram.com"
          settings={deepgramKeyAdapter(deepgramKeySettings)}
        />
      )}

      {sttProvider === "gladia" && (
        <ProviderKeySettings
          providerName="Gladia"
          domain="gladia.io"
          settings={gladiaKeyAdapter(gladiaKeySettings)}
        />
      )}

      <PerformanceSetting lowPowerMode={lowPowerMode} />
    </div>
  )
}
