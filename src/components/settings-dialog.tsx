import {
  lazy,
  Suspense,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ComponentType,
} from "react"
import { invoke } from "@tauri-apps/api/core"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import {
  MicIcon,
  TvIcon,
  KeyIcon,
  CheckIcon,
  BookOpenIcon,
  RadioIcon,
  HelpCircleIcon,
  GraduationCapIcon,
  BrainCircuitIcon,
  CastIcon,
  DownloadIcon,
  HardDriveIcon,
  PaletteIcon,
} from "lucide-react"
import { useBibleStore } from "@/stores/bible-store"
import { useSettingsStore } from "@/stores/settings-store"
import { useTranscriptStore } from "@/stores/transcript-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useAssets } from "@/hooks/use-assets"
import { transcriptionActions } from "@/hooks/use-transcription"
import { useTutorialStore } from "@/stores/tutorial-store"
import {
  useSettingsNavigationStore,
  type SettingsSection,
} from "@/lib/settings-dialog"
import type { DeviceInfo } from "@/types/audio"
import { APP_DISPLAY_NAME } from "@/lib/app-brand"
import { cn } from "@/lib/utils"

const LazyBroadcastSettings = lazy(() =>
  import("@/components/broadcast/broadcast-settings").then((mod) => ({
    default: mod.BroadcastSettings,
  })),
)

const LazyThemeDesigner = lazy(() =>
  import("@/components/broadcast/theme-designer").then((mod) => ({
    default: mod.ThemeDesigner,
  })),
)

/* -------------------------------------------------------------------------- */
/*  Nav definition                                                            */
/* -------------------------------------------------------------------------- */

const navItems: { name: string; id: SettingsSection; icon: React.ReactNode }[] = [
  {
    name: "Audio",
    id: "audio",
    icon: <MicIcon strokeWidth={2} />,
  },
  {
    name: "Speech Recognition",
    id: "speech",
    icon: <BrainCircuitIcon strokeWidth={2} />,
  },
  {
    name: "Bible",
    id: "bible",
    icon: <BookOpenIcon strokeWidth={2} />,
  },
  {
    name: "Display Mode",
    id: "display",
    icon: <TvIcon strokeWidth={2} />,
  },
  {
    name: "Broadcast Settings",
    id: "broadcast",
    icon: <CastIcon strokeWidth={2} />,
  },
  {
    name: "Theme Settings",
    id: "themes",
    icon: <PaletteIcon strokeWidth={2} />,
  },
  {
    name: "Remote Control",
    id: "remote",
    icon: <RadioIcon strokeWidth={2} />,
  },
  {
    name: "API Keys",
    id: "api-keys",
    icon: <KeyIcon strokeWidth={2} />,
  },
  {
    name: "Help",
    id: "help",
    icon: <HelpCircleIcon strokeWidth={2} />,
  },
]

/* -------------------------------------------------------------------------- */
/*  Section: Audio                                                            */
/* -------------------------------------------------------------------------- */

function AudioSection() {
  const { audioDeviceId, setAudioDeviceId, gain, setGain } = useSettingsStore()

  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true)
      const result = await invoke<DeviceInfo[]>("get_audio_devices")
      setDevices(result)
    } catch {
      // Tauri command may not be available during dev
      setDevices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void loadDevices()
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [loadDevices])

  // gain is 0.0-2.0 in store, display as 0-100%
  const gainPercent = Math.round((gain / 2.0) * 100)

  return (
    <div className="flex flex-col gap-6">
      {/* Device selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Input Device
        </label>
        <Select
          value={audioDeviceId ?? "__default__"}
          onValueChange={(v) =>
            setAudioDeviceId(v === "__default__" ? null : v)
          }
          disabled={loading}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue
              placeholder={loading ? "Loading devices..." : "System default"}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">System default</SelectItem>
            {devices.map((device) => (
              <SelectItem key={device.id} value={device.id}>
                {device.name}
                {device.is_default ? " (default)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[0.625rem] text-muted-foreground">
          Selected device persists across sessions. Leave as system default to
          follow OS audio routing.
        </p>
      </div>

      {/* Input gain */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Input Gain
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {gainPercent}%
          </span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[gainPercent]}
          onValueChange={([v]) => setGain((v / 100) * 2.0)}
        />
        <p className="text-[0.625rem] text-muted-foreground">
          Amplifies the incoming audio signal before transcription. 50% is unity
          gain.
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Section: Speech Recognition                                               */
/* -------------------------------------------------------------------------- */

function SpeechSection() {
  const {
    sttProvider,
    setSttProvider,
    hasDeepgramApiKey,
    setHasDeepgramApiKey,
  } = useSettingsStore()

  const [keyValue, setKeyValue] = useState("")
  const [editingSavedKey, setEditingSavedKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [switchingStt, setSwitchingStt] = useState(false)
  const {
    status: assetStatus,
    loading: assetsLoading,
    refresh: refreshAssets,
  } = useAssets()
  const savedKeyDisplay = "Saved in secure keychain"
  const displayedKeyValue =
    hasDeepgramApiKey && !editingSavedKey && !keyValue
      ? savedKeyDisplay
      : keyValue
  const keyActionLabel = hasDeepgramApiKey ? "Update" : "Save"

  const handleKeyAction = async () => {
    if (hasDeepgramApiKey && !editingSavedKey && !keyValue) {
      setEditingSavedKey(true)
      return
    }
    await handleSaveKey()
  }

  const restartActiveTranscription = async () => {
    if (!useTranscriptStore.getState().isTranscribing) return

    setSwitchingStt(true)
    try {
      await transcriptionActions.stop()
      await new Promise((resolve) => setTimeout(resolve, 350))
      await transcriptionActions.start()
    } finally {
      setSwitchingStt(false)
    }
  }

  const handleProviderChange = (provider: "deepgram" | "vosk") => {
    if (provider === sttProvider || switchingStt) return
    setSttProvider(provider)
    void restartActiveTranscription()
  }

  const handleSaveKey = async () => {
    try {
      setKeyError(null)
      await invoke("set_deepgram_api_key", { apiKey: keyValue })
      const hasKey = await invoke<boolean>("has_deepgram_api_key")
      setHasDeepgramApiKey(hasKey)
      if (hasKey) {
        setKeyValue("")
        setEditingSavedKey(false)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        setKeyError("Deepgram API key was not saved")
      }
    } catch (e) {
      setKeyError(String(e))
    }
  }

  const handleClearKey = async () => {
    try {
      setKeyError(null)
      await invoke("clear_deepgram_api_key")
      setHasDeepgramApiKey(false)
      setKeyValue("")
      setEditingSavedKey(false)
    } catch (e) {
      setKeyError(String(e))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Provider selector */}
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
          {/* Deepgram (cloud) */}
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

          {/* Vosk (local) */}
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
                : assetStatus?.vosk_model && assetStatus?.vosk_worker
                  ? "Installed"
                  : "Missing"}
            </Badge>
          </div>

          <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
              Vosk runs with a verse-focused constrained grammar. It recognizes
              Bible book names, numbers, and navigation keywords for fast verse
              reference detection. For full-sermon transcript quality, switch to
              Deepgram. Place the model folder here or set{" "}
              <code className="text-[0.5625rem]">SABBATHCUE_VOSK_MODEL_DIR</code>.
            </p>
          {!assetsLoading &&
            (!assetStatus?.vosk_model || !assetStatus?.vosk_worker) && (
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

      {/* Deepgram settings — show when deepgram is selected */}
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

/* -------------------------------------------------------------------------- */
/*  Section: Display Mode                                                     */
/* -------------------------------------------------------------------------- */

function DisplayModeSection() {
  const { autoMode, setAutoMode, confidenceThreshold, setConfidenceThreshold } =
    useSettingsStore()

  const thresholdPercent = Math.round(confidenceThreshold * 100)

  return (
    <div className="flex flex-col gap-6">
      {/* Mode selector */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Broadcast Mode
        </label>

        <RadioGroup
          value={autoMode ? "auto" : "manual"}
          onValueChange={(v) => setAutoMode(v === "auto")}
          className="gap-3"
        >
          {/* Auto mode */}
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

          {/* Manual mode */}
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

      {/* Auto-live threshold — only when auto */}
      {autoMode && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Auto-live Threshold
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
            Only verses above this threshold are sent live automatically.
            Semantic and testimony-based suggestions still appear for review.
          </p>
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Section: API Keys                                                         */
/* -------------------------------------------------------------------------- */

function ApiKeysSection() {
  const { hasDeepgramApiKey, sttProvider } = useSettingsStore()

  return (
    <div className="flex flex-col gap-6">
      {/* Deepgram key status (configured in Speech Recognition section) */}
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
          {sttProvider === "vosk"
            ? "Not required when using local Vosk. "
            : "Required for cloud transcription. "}
          Configure in the Speech Recognition section.
        </p>
      </div>
    </div>
  )
}

function BroadcastSection() {
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [broadcastSettingsMounted, setBroadcastSettingsMounted] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-white/5 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Broadcast outputs
            </p>
            <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
              Manage projector targets, fullscreen output, NDI routing, and the
              active themes used on your audience displays.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setBroadcastSettingsMounted(true)
              setBroadcastOpen(true)
            }}
          >
            <CastIcon className="size-3.5" />
            Open broadcast settings
          </Button>
        </div>
      </div>

      {broadcastSettingsMounted ? (
        <Suspense fallback={null}>
          <LazyBroadcastSettings
            open={broadcastOpen}
            onOpenChange={setBroadcastOpen}
          />
        </Suspense>
      ) : null}
    </div>
  )
}

function ThemeSection() {
  const [themeDesignerMounted, setThemeDesignerMounted] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-white/5 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Theme designer
            </p>
            <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
              Adjust lyric layouts, lower thirds, fonts, backgrounds, and text
              positioning in the full-screen theme workspace.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setThemeDesignerMounted(true)
              useBroadcastStore.getState().setDesignerOpen(true)
            }}
          >
            <PaletteIcon className="size-3.5" />
            Open theme designer
          </Button>
        </div>
      </div>

      {themeDesignerMounted ? (
        <Suspense fallback={null}>
          <LazyThemeDesigner />
        </Suspense>
      ) : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Section titles                                                            */
/* -------------------------------------------------------------------------- */

const sectionTitles: Record<SettingsSection, string> = {
  audio: "Audio",
  speech: "Speech Recognition",
  bible: "Bible Translation",
  display: "Display Mode",
  broadcast: "Broadcast Settings",
  themes: "Theme Settings",
  remote: "Remote Control",
  "api-keys": "API Keys",
  help: "Help",
}

/* -------------------------------------------------------------------------- */
/*  Section: Bible Translation                                                */
/* -------------------------------------------------------------------------- */

interface TranslationInfo {
  id: number
  abbreviation: string
  title: string
  language: string
}

function BibleSection() {
  const [translations, setTranslations] = useState<TranslationInfo[]>([])
  const [activeId, setActiveId] = useState<number>(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [trans, active] = await Promise.all([
          invoke<TranslationInfo[]>("list_translations"),
          invoke<number>("get_active_translation"),
        ])
        setTranslations(trans)
        setActiveId(active)
      } catch (e) {
        console.error("Failed to load translations:", e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleChange = async (value: string) => {
    const id = parseInt(value)
    try {
      await invoke("set_active_translation", { translationId: id })
      setActiveId(id)
      // Update frontend stores so all panels use the new translation
      useBibleStore.getState().setActiveTranslation(id)
    } catch (e) {
      console.error("Failed to set translation:", e)
    }
  }

  const englishTranslations = translations.filter((t) => t.language === "en")
  const otherTranslations = translations.filter((t) => t.language !== "en")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Primary Translation
        </label>
        <Select
          value={String(activeId)}
          onValueChange={handleChange}
          disabled={loading}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue
              placeholder={loading ? "Loading..." : "Select translation"}
            />
          </SelectTrigger>
          <SelectContent>
            {englishTranslations.length > 0 && (
              <>
                <div className="px-2 py-1 text-[0.5625rem] font-medium tracking-wider text-muted-foreground uppercase">
                  English
                </div>
                {englishTranslations.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.abbreviation} — {t.title}
                  </SelectItem>
                ))}
              </>
            )}
            {otherTranslations.length > 0 && (
              <>
                <div className="mt-1 px-2 py-1 text-[0.5625rem] font-medium tracking-wider text-muted-foreground uppercase">
                  Other Languages
                </div>
                {otherTranslations.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.abbreviation} — {t.title}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
        <p className="text-[0.625rem] text-muted-foreground">
          Detected verses will display in this translation.
          {translations.length > 0 &&
            ` ${translations.length} translations available.`}
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Section: Remote Control                                                   */
/* -------------------------------------------------------------------------- */

interface RemoteStatus {
  running: boolean
  port: number | null
}

interface CommandLogEntry {
  id: number
  timestamp: string
  source: "OSC" | "HTTP"
  command: string
}

function RemoteControlSection() {
  const [oscPort, setOscPort] = useState("8000")
  const [httpPort, setHttpPort] = useState("8080")
  const [oscStatus, setOscStatus] = useState<RemoteStatus>({
    running: false,
    port: null,
  })
  const [httpStatus, setHttpStatus] = useState<RemoteStatus>({
    running: false,
    port: null,
  })
  const [httpTokenConfigured, setHttpTokenConfigured] = useState(false)
  const [oscError, setOscError] = useState<string | null>(null)
  const [httpError, setHttpError] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [commandLog, setCommandLog] = useState<CommandLogEntry[]>([])
  const logIdRef = useRef(0)

  // Poll statuses
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const osc = await invoke<RemoteStatus>("get_osc_status")
        setOscStatus(osc)
        if (osc.running) setOscError(null)
      } catch {
        /* ignore */
      }
      try {
        const http = await invoke<RemoteStatus>("get_http_status")
        setHttpStatus(http)
        if (http.running) setHttpError(null)
      } catch {
        /* ignore */
      }
      try {
        const hasToken = await invoke<boolean>("has_remote_http_token")
        setHttpTokenConfigured(hasToken)
      } catch {
        // If the command isn't available (dev/web), don't spam errors.
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // Listen for remote commands to populate the log
  useEffect(() => {
    let cancelled = false
    const unlisteners: (() => void)[] = []

    async function setup() {
      const { listen } = await import("@tauri-apps/api/event")

      const remoteEvents = [
        "remote:next",
        "remote:prev",
        "remote:theme",
        "remote:opacity",
        "remote:on_air",
        "remote:show",
        "remote:hide",
        "remote:confidence",
      ]

      for (const event of remoteEvents) {
        const unlisten = await listen(event, () => {
          if (cancelled) return
          const entry: CommandLogEntry = {
            id: logIdRef.current++,
            timestamp: new Date().toLocaleTimeString(),
            source: "OSC", // We can't distinguish source at event level; default to OSC
            command: event.replace("remote:", ""),
          }
          setCommandLog((prev) => [entry, ...prev].slice(0, 50))
        })
        unlisteners.push(unlisten)
      }
    }

    setup()
    return () => {
      cancelled = true
      unlisteners.forEach((fn) => fn())
    }
  }, [])

  const handleOscToggle = async () => {
    try {
      if (oscStatus.running) {
        await invoke("stop_osc")
        setOscError(null)
      } else {
        const parsed = parseInt(oscPort, 10)
        const port = Number.isFinite(parsed) ? parsed : 8000
        const boundPort = await invoke<number>("start_osc", { port })
        setOscPort(String(boundPort))
        setOscError(null)
      }
    } catch (e) {
      setOscError(String(e))
    }
  }

  const handleHttpToggle = async () => {
    try {
      if (httpStatus.running) {
        await invoke("stop_http")
        setHttpError(null)
      } else {
        const parsed = parseInt(httpPort, 10)
        const port = Number.isFinite(parsed) ? parsed : 8080
        const boundPort = await invoke<number>("start_http", { port })
        setHttpPort(String(boundPort))
        setHttpError(null)
      }
    } catch (e) {
      setHttpError(String(e))
    }
  }

  const handleCopyHttpToken = async () => {
    try {
      setTokenError(null)
      const token = await invoke<string>("reveal_remote_http_token")
      await navigator.clipboard.writeText(token)
    } catch (e) {
      setTokenError(String(e))
    }
  }

  const handleRotateHttpToken = async () => {
    try {
      setTokenError(null)
      const token = await invoke<string>("rotate_remote_http_token")
      await navigator.clipboard.writeText(token)
      setHttpTokenConfigured(true)
    } catch (e) {
      setTokenError(String(e))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* OSC */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          OSC (Open Sound Control)
        </label>
        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2">
            <label className="text-xs text-muted-foreground">Port</label>
            <Input
              type="number"
              value={oscPort}
              onChange={(e) => setOscPort(e.target.value)}
              className="h-7 w-24 text-xs"
              disabled={oscStatus.running}
            />
          </div>
          <StatusDot running={oscStatus.running} />
          <Button
            size="sm"
            variant={oscStatus.running ? "destructive" : "default"}
            onClick={handleOscToggle}
            className="text-xs"
          >
            {oscStatus.running ? "Stop" : "Start"}
          </Button>
        </div>
        {oscError && <p className="text-[0.625rem] text-red-500">{oscError}</p>}
        {oscStatus.running && oscStatus.port && (
          <p className="text-[0.625rem] text-muted-foreground">
            Listening on UDP port {oscStatus.port}
          </p>
        )}
        <p className="text-[0.625rem] text-muted-foreground">
          Receives commands from hardware controllers (Stream Deck, TouchOSC,
          Companion) via OSC over UDP.
        </p>
      </div>

      {/* HTTP API */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          HTTP API
        </label>
        <div className="flex items-center gap-3">
          <div className="flex flex-1 items-center gap-2">
            <label className="text-xs text-muted-foreground">Port</label>
            <Input
              type="number"
              value={httpPort}
              onChange={(e) => setHttpPort(e.target.value)}
              className="h-7 w-24 text-xs"
              disabled={httpStatus.running}
            />
          </div>
          <StatusDot running={httpStatus.running} />
          <Button
            size="sm"
            variant={httpStatus.running ? "destructive" : "default"}
            onClick={handleHttpToggle}
            className="text-xs"
          >
            {httpStatus.running ? "Stop" : "Start"}
          </Button>
        </div>
        {httpError && (
          <p className="text-[0.625rem] text-red-500">{httpError}</p>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[0.625rem] text-muted-foreground">Token</span>
            <Badge variant="outline" className="text-[0.5rem]">
              {httpTokenConfigured ? "Configured" : "Missing"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleCopyHttpToken()}
              className="text-xs"
              disabled={!httpTokenConfigured}
            >
              Copy token
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRotateHttpToken()}
              className="text-xs"
            >
              Rotate
            </Button>
          </div>
        </div>
        {tokenError && (
          <p className="text-[0.625rem] text-red-500">{tokenError}</p>
        )}
        {httpStatus.running && httpStatus.port && (
          <p className="text-[0.625rem] text-muted-foreground">
            Serving on http://localhost:{httpStatus.port}/api/v1/
          </p>
        )}
        <p className="text-[0.625rem] text-muted-foreground">
          REST API for status queries and control commands. Use with custom
          dashboards, automation scripts, or HTTP-capable controllers.
        </p>
      </div>

      {/* Firewall guidance */}
      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="mb-1 text-[0.625rem] font-medium text-muted-foreground">
          Firewall Note
        </p>
        <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
          Remote control binds to this computer only by default. LAN exposure
          should be added later as an explicit opt-in with authentication.
        </p>
      </div>

      {/* Command Log */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Command Log
          </label>
          {commandLog.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[0.5rem]"
              onClick={() => setCommandLog([])}
            >
              Clear
            </Button>
          )}
        </div>
        <div className="h-32 overflow-y-auto rounded-lg border border-white/5 bg-black/40 p-2">
          {commandLog.length === 0 ? (
            <p className="mt-8 text-center text-[0.625rem] text-muted-foreground">
              No commands received yet
            </p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {commandLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 text-[0.625rem]"
                >
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {entry.timestamp}
                  </span>
                  <Badge variant="outline" className="h-3.5 px-1 text-[0.5rem]">
                    {entry.source}
                  </Badge>
                  <span className="font-mono text-foreground">
                    {entry.command}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Section: Help                                                             */
/* -------------------------------------------------------------------------- */

function HelpSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Resources to help you get the most out of {APP_DISPLAY_NAME}.
        </p>
      </div>

      <div className="space-y-3">
        <div className="glass-panel flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <GraduationCapIcon className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Interactive Tutorial</p>
              <p className="text-xs text-muted-foreground">
                Step-by-step walkthrough of every feature
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              useTutorialStore.getState().startTutorial()
            }}
          >
            <GraduationCapIcon className="mr-1.5 size-3.5" />
            Restart
          </Button>
        </div>

        <div className="glass-panel flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <KeyIcon className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">Keyboard Shortcuts</p>
              <p className="text-xs text-muted-foreground">
                Arrow keys navigate the tutorial, Esc to dismiss
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusDot({ running }: { running: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`size-2 rounded-full ${
          running ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/30"
        }`}
      />
      <span className="text-[0.625rem] text-muted-foreground">
        {running ? "Listening" : "Stopped"}
      </span>
    </div>
  )
}

const sectionComponents: Record<SettingsSection, ComponentType> = {
  audio: AudioSection,
  speech: SpeechSection,
  bible: BibleSection,
  display: DisplayModeSection,
  broadcast: BroadcastSection,
  themes: ThemeSection,
  remote: RemoteControlSection,
  "api-keys": ApiKeysSection,
  help: HelpSection,
}

/*  Full-page System Settings workspace                                         */
/* -------------------------------------------------------------------------- */

export function SettingsPage() {
  const activeSection = useSettingsNavigationStore((s) => s.activeSection)
  const setActiveSection = useSettingsNavigationStore((s) => s.setActiveSection)
  const pendingScroll = useSettingsNavigationStore((s) => s.pendingScroll)
  const clearPendingScroll = useSettingsNavigationStore(
    (s) => s.clearPendingScroll,
  )

  const ActiveContent = sectionComponents[activeSection]

  useEffect(() => {
    if (!pendingScroll) return
    const el = document.getElementById(`settings-section-${activeSection}`)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
    clearPendingScroll()
  }, [activeSection, pendingScroll, clearPendingScroll])

  return (
    <div className="view-pane flex flex-col gap-5" data-tour="settings">
      <div className="glass-panel p-5">
        <h2 className="mb-2 text-2xl font-bold text-white">
          Configuration and Hardware Setup
        </h2>
        <p className="text-sm text-slate-400">
          Manage audio capture feeds, interface endpoints, downstream
          configurations, and keyboard shortcuts.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[220px_1fr]">
        <nav
          className="glass-panel flex flex-col gap-1 p-3"
          aria-label="Settings sections"
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={cn(
                "btn-tab flex items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 text-left text-xs",
                activeSection === item.id && "active",
                activeSection === item.id
                  ? "text-[var(--accent)]"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
              )}
            >
              {item.icon}
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        <section
          id={`settings-section-${activeSection}`}
          className="glass-panel min-h-0 overflow-y-auto p-5 scrollbar-thin"
        >
          <h3 className="mb-4 border-b border-white/5 pb-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            {sectionTitles[activeSection]}
          </h3>
          <ActiveContent />
        </section>
      </div>
    </div>
  )
}
