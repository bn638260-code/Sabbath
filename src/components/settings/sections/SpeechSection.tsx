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

export function SpeechSection() {
  const lowPowerMode = useSettingsStore((s) => s.lowPowerMode)
  const {
    sttProvider,
    hasDeepgramApiKey,
    keyValue,
    setKeyValue,
    editingSavedKey,
    setEditingSavedKey,
    saved,
    keyError,
    switchingStt,
    displayedKeyValue,
    keyActionLabel,
    handleKeyAction,
    handleClearKey,
    handleProviderChange,
  } = useDeepgramKeySettings()
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
  const voskMissingMessage = !assetStatus?.vosk_model
    ? "Vosk model files are missing from the app resources or configured model path."
    : !assetStatus?.vosk_worker
      ? "Vosk worker script is missing from the app resources."
      : !assetStatus?.vosk_runtime
        ? assetStatus?.vosk_runtime_error ||
          "Python is available, but the Vosk package could not be loaded."
        : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Provider
        </label>

        <RadioGroup
          value={sttProvider}
          onValueChange={(v) => handleProviderChange(v as SttProvider)}
          disabled={switchingStt}
          className="gap-3"
        >
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20 ${
              sttProvider !== "deepgram"
                ? "hover:border-muted-foreground/25"
                : ""
            }`}
          >
            <RadioGroupItem value="deepgram" className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">
                Cloud (Deepgram, optional paid)
              </span>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
                Uses Deepgram Nova-3 for real-time streaming transcription.
                Requires an API key and internet connection. Best accuracy with
                keyword boosting for Bible terms.
              </p>
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20 ${
              sttProvider !== "gladia" ? "hover:border-muted-foreground/25" : ""
            }`}
          >
            <RadioGroupItem value="gladia" className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">
                Cloud (Gladia)
              </span>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
                Uses Gladia Solaria-1 for real-time streaming transcription.
                Requires an API key and internet connection. Runs English-only
                live captions through the same verse detection pipeline.
              </p>
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20 ${
              sttProvider !== "vosk" ? "hover:border-muted-foreground/25" : ""
            }`}
          >
            <RadioGroupItem value="vosk" className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">
                Local (Vosk)
              </span>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
                Uses a verse-focused constrained grammar for fast Bible
                reference detection. Free after the model is installed, and
                audio never leaves your machine. For full-sermon transcript
                quality, use Deepgram.
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {sttProvider === "vosk" && (
        <div className="flex flex-col gap-3 rounded-lg border border-white/5 bg-white/5 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <HardDriveIcon className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">
                Local model status
              </span>
            </div>
            <Badge variant="outline" className="text-[0.5rem]">
              {assetsLoading
                ? "Checking"
                : voskReady
                  ? voskModelQuality || "Installed"
                  : "Missing"}
            </Badge>
          </div>

          <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
            Vosk runs with a verse-focused constrained grammar. For better
            offline recognition, install{" "}
            <code className="text-[0.5625rem]">
              vosk-model-en-us-0.22-lgraph
            </code>
            . The smaller{" "}
            <code className="text-[0.5625rem]">vosk-model-small-en-us</code>{" "}
            model remains supported as a fallback. Development builds using the
            Python worker also need the{" "}
            <code className="text-[0.5625rem]">vosk</code> package installed.
            Place the model folder here or set{" "}
            <code className="text-[0.5625rem]">SABBATHCUE_VOSK_MODEL_DIR</code>.
          </p>
          {!assetsLoading && voskModelName && (
            <p className="rounded-md bg-black/40 px-2 py-1.5 font-mono text-[0.625rem] text-muted-foreground">
              Active model: {voskModelName}
            </p>
          )}
          {!assetsLoading && voskMissingMessage && (
            <p className="rounded-md bg-black/40 px-2 py-1.5 font-mono text-[0.625rem] text-muted-foreground">
              {voskMissingMessage}
            </p>
          )}
          {!assetsLoading && !assetStatus?.vosk_model && (
            <p className="rounded-md bg-black/40 px-2 py-1.5 font-mono text-[0.625rem] text-muted-foreground">
              models\vosk\vosk-model-en-us-0.22-lgraph
            </p>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => void refreshAssets()}
            className="w-fit text-xs"
          >
            <DownloadIcon className="size-3" />
            Refresh asset status
          </Button>
        </div>
      )}

      {sttProvider === "deepgram" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Deepgram API Key
            </label>
            {hasDeepgramApiKey && (
              <Badge variant="outline" className="text-[0.5rem]">
                Key configured
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              type={
                hasDeepgramApiKey && !editingSavedKey && !keyValue
                  ? "text"
                  : "password"
              }
              placeholder="Enter your Deepgram API key..."
              value={displayedKeyValue}
              readOnly={hasDeepgramApiKey && !editingSavedKey && !keyValue}
              onChange={(e) => {
                setEditingSavedKey(true)
                setKeyValue(e.target.value)
              }}
              className="flex-1 text-xs"
            />
            <Button size="sm" onClick={() => void handleKeyAction()}>
              {saved ? (
                <>
                  <CheckIcon className="size-3" />
                  Saved
                </>
              ) : (
                keyActionLabel
              )}
            </Button>
            {hasDeepgramApiKey && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleClearKey()}
              >
                Remove
              </Button>
            )}
          </div>
          {keyError && (
            <p className="text-[0.625rem] text-red-500">{keyError}</p>
          )}
          <p className="text-[0.625rem] text-muted-foreground">
            Required for live transcription. Get a key at{" "}
            <span className="text-primary">deepgram.com</span>
          </p>
        </div>
      )}

      {sttProvider === "gladia" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Gladia API Key
            </label>
            {gladiaKeySettings.hasGladiaApiKey && (
              <Badge variant="outline" className="text-[0.5rem]">
                Key configured
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              type={
                gladiaKeySettings.hasGladiaApiKey &&
                !gladiaKeySettings.editingSavedKey &&
                !gladiaKeySettings.keyValue
                  ? "text"
                  : "password"
              }
              placeholder="Enter your Gladia API key..."
              value={gladiaKeySettings.displayedKeyValue}
              readOnly={
                gladiaKeySettings.hasGladiaApiKey &&
                !gladiaKeySettings.editingSavedKey &&
                !gladiaKeySettings.keyValue
              }
              onChange={(e) => {
                gladiaKeySettings.setEditingSavedKey(true)
                gladiaKeySettings.setKeyValue(e.target.value)
              }}
              className="flex-1 text-xs"
            />
            <Button
              size="sm"
              onClick={() => void gladiaKeySettings.handleKeyAction()}
            >
              {gladiaKeySettings.saved ? (
                <>
                  <CheckIcon className="size-3" />
                  Saved
                </>
              ) : (
                gladiaKeySettings.keyActionLabel
              )}
            </Button>
            {gladiaKeySettings.hasGladiaApiKey && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void gladiaKeySettings.handleClearKey()}
              >
                Remove
              </Button>
            )}
          </div>
          {gladiaKeySettings.keyError && (
            <p className="text-[0.625rem] text-red-500">
              {gladiaKeySettings.keyError}
            </p>
          )}
          <p className="text-[0.625rem] text-muted-foreground">
            Required for live transcription. Get a key at{" "}
            <span className="text-primary">gladia.io</span>
          </p>
        </div>
      )}

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
                detection runs only on finished sentences instead of live
                partial speech; spoken references like &quot;John 3:16&quot; are
                still detected instantly. Takes effect the next time
                transcription starts.
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
    </div>
  )
}
