import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useAssets } from "@/hooks/use-assets"
import { useDeepgramKeySettings } from "@/hooks/use-deepgram-key-settings"
import { CheckIcon, DownloadIcon, HardDriveIcon } from "lucide-react"

export function SpeechSection() {
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

  const {
    status: assetStatus,
    loading: assetsLoading,
    refresh: refreshAssets,
  } = useAssets()

  const voskReady = Boolean(
    assetStatus?.vosk_model &&
      assetStatus?.vosk_worker &&
      assetStatus?.vosk_runtime,
  )
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
          onValueChange={(v) => handleProviderChange(v as "deepgram" | "vosk")}
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
              {assetsLoading ? "Checking" : voskReady ? "Installed" : "Missing"}
            </Badge>
          </div>

          <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
            Vosk runs with a verse-focused constrained grammar. It recognizes
            Bible book names, numbers, and navigation keywords for fast verse
            reference detection. This build also needs Python with the{" "}
            <code className="text-[0.5625rem]">vosk</code> package installed.
            Place the model folder here or set{" "}
            <code className="text-[0.5625rem]">SABBATHCUE_VOSK_MODEL_DIR</code>.
          </p>
          {!assetsLoading && voskMissingMessage && (
            <p className="rounded-md bg-black/40 px-2 py-1.5 font-mono text-[0.625rem] text-muted-foreground">
              {voskMissingMessage}
            </p>
          )}
          {!assetsLoading && !assetStatus?.vosk_model && (
            <p className="rounded-md bg-black/40 px-2 py-1.5 font-mono text-[0.625rem] text-muted-foreground">
              C:\Users\fanel\Downloads\vosk-model-small-en-us
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
    </div>
  )
}
