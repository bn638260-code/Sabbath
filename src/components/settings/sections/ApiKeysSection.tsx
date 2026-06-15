import { Badge } from "@/components/ui/badge"
import { useSettingsStore } from "@/stores/settings-store"

export function ApiKeysSection() {
  const { hasDeepgramApiKey, hasGladiaApiKey, sttProvider } = useSettingsStore()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Deepgram API Key
          </label>
          {hasDeepgramApiKey ? (
            <Badge variant="outline" className="text-[0.5rem]">
              Key configured
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[0.5rem] text-muted-foreground"
            >
              Not set
            </Badge>
          )}
        </div>
        <p className="text-[0.625rem] text-muted-foreground">
          {sttProvider === "sherpa" || sttProvider === "vosk"
            ? "Not required when using local speech recognition. "
            : "Required for cloud transcription. "}
          Configure in the Speech Recognition section.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Gladia API Key
          </label>
          {hasGladiaApiKey ? (
            <Badge variant="outline" className="text-[0.5rem]">
              Key configured
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[0.5rem] text-muted-foreground"
            >
              Not set
            </Badge>
          )}
        </div>
        <p className="text-[0.625rem] text-muted-foreground">
          {sttProvider === "sherpa" || sttProvider === "vosk"
            ? "Not required when using local speech recognition. "
            : "Required for cloud transcription. "}
          Configure in the Speech Recognition section.
        </p>
      </div>
    </div>
  )
}
