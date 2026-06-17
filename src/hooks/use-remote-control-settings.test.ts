// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  COMMAND_LOG_LIMIT,
  copyRemoteHttpToken,
  createCommandLogEntry,
  fetchRemoteStatuses,
  HTTP_TOKEN_CLIPBOARD_ERROR_MESSAGE,
  parseRemotePort,
  rotateRemoteHttpToken,
  toggleHttpServer,
  toggleOscServer,
  useRemoteControlSettings,
} from "./use-remote-control-settings"

const mockInvoke = vi.fn()
const mockListen = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}))

describe("use-remote-control-settings helpers", () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockListen.mockReset()
    mockListen.mockResolvedValue(() => {})
  })

  describe("parseRemotePort", () => {
    it("parses valid port strings", () => {
      expect(parseRemotePort("9001", 8000)).toBe(9001)
    })

    it("falls back when the port is invalid", () => {
      expect(parseRemotePort("not-a-port", 8080)).toBe(8080)
    })
  })

  describe("createCommandLogEntry", () => {
    it("strips the remote: prefix from event names", () => {
      expect(
        createCommandLogEntry(1, "remote:next", "12:00:00"),
      ).toEqual({
        id: 1,
        timestamp: "12:00:00",
        source: "OSC",
        command: "next",
      })
    })
  })

  describe("fetchRemoteStatuses", () => {
    it("returns all statuses when commands succeed", async () => {
      mockInvoke
        .mockResolvedValueOnce({ running: true, port: 8000 })
        .mockResolvedValueOnce({ running: false, port: null })
        .mockResolvedValueOnce(true)

      await expect(fetchRemoteStatuses()).resolves.toEqual({
        osc: { running: true, port: 8000 },
        http: { running: false, port: null },
        httpTokenConfigured: true,
      })
      expect(mockInvoke).toHaveBeenCalledWith("get_osc_status")
      expect(mockInvoke).toHaveBeenCalledWith("get_http_status")
      expect(mockInvoke).toHaveBeenCalledWith("has_remote_http_token")
    })

    it("tolerates missing runtime commands without throwing", async () => {
      mockInvoke.mockRejectedValue(new Error("no runtime"))

      await expect(fetchRemoteStatuses()).resolves.toEqual({
        osc: null,
        http: null,
        httpTokenConfigured: null,
      })
    })
  })

  describe("toggleOscServer", () => {
    it("starts OSC on the parsed port", async () => {
      mockInvoke.mockResolvedValue(8001)

      await expect(toggleOscServer(false, "8001")).resolves.toEqual({
        boundPort: 8001,
      })
      expect(mockInvoke).toHaveBeenCalledWith("start_osc", { port: 8001 })
    })

    it("stops OSC when already running", async () => {
      mockInvoke.mockResolvedValue(undefined)

      await expect(toggleOscServer(true, "8000")).resolves.toEqual({})
      expect(mockInvoke).toHaveBeenCalledWith("stop_osc")
    })

    it("returns command failures without throwing", async () => {
      mockInvoke.mockRejectedValue(new Error("bind failed"))

      await expect(toggleOscServer(false, "8000")).resolves.toEqual({
        error: "Error: bind failed",
      })
    })
  })

  describe("toggleHttpServer", () => {
    it("starts HTTP on the parsed port", async () => {
      mockInvoke.mockResolvedValue(8081)

      await expect(toggleHttpServer(false, "8081")).resolves.toEqual({
        boundPort: 8081,
      })
      expect(mockInvoke).toHaveBeenCalledWith("start_http", { port: 8081 })
    })

    it("stops HTTP when already running", async () => {
      mockInvoke.mockResolvedValue(undefined)

      await expect(toggleHttpServer(true, "8080")).resolves.toEqual({})
      expect(mockInvoke).toHaveBeenCalledWith("stop_http")
    })
  })

  describe("rotateRemoteHttpToken", () => {
    it("returns the rotated token on success", async () => {
      mockInvoke.mockResolvedValue("new-token")

      await expect(rotateRemoteHttpToken()).resolves.toEqual({
        token: "new-token",
      })
    })

    it("returns command failures without throwing", async () => {
      mockInvoke.mockRejectedValue(new Error("rotate failed"))

      await expect(rotateRemoteHttpToken()).resolves.toEqual({
        error: "Error: rotate failed",
      })
    })
  })

  describe("copyRemoteHttpToken", () => {
    it("copies the provided token only when explicitly requested", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      })

      await expect(copyRemoteHttpToken("new-token")).resolves.toEqual({})
      expect(writeText).toHaveBeenCalledWith("new-token")
    })

    it("returns clipboard failures without throwing", async () => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      })

      await expect(copyRemoteHttpToken("new-token")).resolves.toEqual({
        error: HTTP_TOKEN_CLIPBOARD_ERROR_MESSAGE,
      })
    })
  })

  describe("useRemoteControlSettings", () => {
    it("does not overwrite the clipboard when rotating a token", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      })
      mockInvoke.mockImplementation(async (command: string) => {
        if (command === "rotate_remote_http_token") return "new-token"
        return null
      })

      const { result, unmount } = renderHook(() => useRemoteControlSettings())

      await act(async () => {
        await result.current.handleRotateHttpToken()
      })

      expect(result.current.httpTokenConfigured).toBe(true)
      expect(result.current.rotatedHttpToken).toBe("new-token")
      expect(writeText).not.toHaveBeenCalled()

      await act(async () => {
        await result.current.handleCopyHttpToken()
      })

      expect(writeText).toHaveBeenCalledWith("new-token")
      unmount()
    })
  })

  it("keeps the command log limit at 50 entries", () => {
    expect(COMMAND_LOG_LIMIT).toBe(50)
  })
})
