import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useAudioDevices } from "@/hooks/use-audio-devices"
import { useSettingsStore } from "@/stores/settings-store"

export function AudioSection() {
  const { audioDeviceId, setAudioDeviceId, gain, setGain } = useSettingsStore()
  const { devices, loading } = useAudioDevices()

  const gainPercent = Math.round((gain / 2.0) * 100)

  return (
    <div className="flex flex-col gap-6">
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
