import { useCallback, useEffect, useRef, useState } from "react"
import { invokeTauri } from "@/lib/tauri-runtime"

export interface RemoteStatus {
  running: boolean
  port: number | null
}

export interface CommandLogEntry {
  id: number
  timestamp: string
  source: "OSC" | "HTTP"
  command: string
}

export const REMOTE_EVENTS = [
  "remote:next",
  "remote:prev",
  "remote:theme",
  "remote:opacity",
  "remote:on_air",
  "remote:show",
  "remote:hide",
  "remote:confidence",
] as const

export const REMOTE_STATUS_POLL_MS = 2000
export const COMMAND_LOG_LIMIT = 50

export const HTTP_TOKEN_COPY_MESSAGE =
  "Remote HTTP tokens cannot be revealed after creation. Rotate the token to issue a new one."

export function parseRemotePort(value: string, fallback: number): number {
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function createCommandLogEntry(
  id: number,
  event: string,
  timestamp = new Date().toLocaleTimeString(),
): CommandLogEntry {
  return {
    id,
    timestamp,
    source: "OSC",
    command: event.replace("remote:", ""),
  }
}

export async function fetchRemoteStatuses(): Promise<{
  osc: RemoteStatus | null
  http: RemoteStatus | null
  httpTokenConfigured: boolean | null
}> {
  let osc: RemoteStatus | null = null
  let http: RemoteStatus | null = null
  let httpTokenConfigured: boolean | null = null

  try {
    osc = await invokeTauri<RemoteStatus>("get_osc_status")
  } catch {
    /* ignore */
  }
  try {
    http = await invokeTauri<RemoteStatus>("get_http_status")
  } catch {
    /* ignore */
  }
  try {
    httpTokenConfigured = await invokeTauri<boolean>("has_remote_http_token")
  } catch {
    /* no-runtime fallback */
  }

  return { osc, http, httpTokenConfigured }
}

export async function toggleOscServer(
  running: boolean,
  portStr: string,
): Promise<{ boundPort?: number; error?: string }> {
  try {
    if (running) {
      await invokeTauri("stop_osc")
      return {}
    }
    const port = parseRemotePort(portStr, 8000)
    const boundPort = await invokeTauri<number>("start_osc", { port })
    return { boundPort }
  } catch (e) {
    return { error: String(e) }
  }
}

export async function toggleHttpServer(
  running: boolean,
  portStr: string,
): Promise<{ boundPort?: number; error?: string }> {
  try {
    if (running) {
      await invokeTauri("stop_http")
      return {}
    }
    const port = parseRemotePort(portStr, 8080)
    const boundPort = await invokeTauri<number>("start_http", { port })
    return { boundPort }
  } catch (e) {
    return { error: String(e) }
  }
}

export async function rotateRemoteHttpToken(): Promise<{
  token?: string
  error?: string
}> {
  try {
    const token = await invokeTauri<string>("rotate_remote_http_token")
    return { token }
  } catch (e) {
    return { error: String(e) }
  }
}

export function useRemoteControlSettings() {
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

  useEffect(() => {
    const interval = setInterval(async () => {
      const statuses = await fetchRemoteStatuses()
      if (statuses.osc) {
        setOscStatus(statuses.osc)
        if (statuses.osc.running) setOscError(null)
      }
      if (statuses.http) {
        setHttpStatus(statuses.http)
        if (statuses.http.running) setHttpError(null)
      }
      if (statuses.httpTokenConfigured !== null) {
        setHttpTokenConfigured(statuses.httpTokenConfigured)
      }
    }, REMOTE_STATUS_POLL_MS)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let cancelled = false
    const unlisteners: (() => void)[] = []

    async function setup() {
      const { listen } = await import("@tauri-apps/api/event")

      for (const event of REMOTE_EVENTS) {
        const unlisten = await listen(event, () => {
          if (cancelled) return
          const entry = createCommandLogEntry(logIdRef.current++, event)
          setCommandLog((prev) => [entry, ...prev].slice(0, COMMAND_LOG_LIMIT))
        })
        unlisteners.push(unlisten)
      }
    }

    void setup()
    return () => {
      cancelled = true
      unlisteners.forEach((fn) => fn())
    }
  }, [])

  const handleOscToggle = useCallback(async () => {
    const result = await toggleOscServer(oscStatus.running, oscPort)
    if (result.error) {
      setOscError(result.error)
      return
    }
    setOscError(null)
    if (result.boundPort !== undefined) {
      setOscPort(String(result.boundPort))
    }
  }, [oscPort, oscStatus.running])

  const handleHttpToggle = useCallback(async () => {
    const result = await toggleHttpServer(httpStatus.running, httpPort)
    if (result.error) {
      setHttpError(result.error)
      return
    }
    setHttpError(null)
    if (result.boundPort !== undefined) {
      setHttpPort(String(result.boundPort))
    }
  }, [httpPort, httpStatus.running])

  const handleCopyHttpToken = useCallback(async () => {
    setTokenError(HTTP_TOKEN_COPY_MESSAGE)
  }, [])

  const handleRotateHttpToken = useCallback(async () => {
    setTokenError(null)
    const result = await rotateRemoteHttpToken()
    if (result.error) {
      setTokenError(result.error)
      return
    }
    if (result.token) {
      await navigator.clipboard.writeText(result.token)
      setHttpTokenConfigured(true)
    }
  }, [])

  const clearCommandLog = useCallback(() => {
    setCommandLog([])
  }, [])

  return {
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
  }
}
