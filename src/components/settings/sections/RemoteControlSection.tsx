import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useRemoteControlSettings } from "@/hooks/use-remote-control-settings"
import { StatusDot } from "./StatusDot"

export function RemoteControlSection() {
  const {
    oscPort,
    setOscPort,
    httpPort,
    setHttpPort,
    oscStatus,
    httpStatus,
    httpTokenConfigured,
    oscError,
    httpError,
    tokenError,
    commandLog,
    handleOscToggle,
    handleHttpToggle,
    handleCopyHttpToken,
    handleRotateHttpToken,
    clearCommandLog,
  } = useRemoteControlSettings()

  return (
    <div className="flex flex-col gap-6">
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
            onClick={() => void handleOscToggle()}
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
            onClick={() => void handleHttpToggle()}
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

      <div className="rounded-lg border border-white/5 bg-white/5 p-3">
        <p className="mb-1 text-[0.625rem] font-medium text-muted-foreground">
          Firewall Note
        </p>
        <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
          Remote control binds to this computer only by default. LAN exposure
          should be added later as an explicit opt-in with authentication.
        </p>
      </div>

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
              onClick={clearCommandLog}
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
