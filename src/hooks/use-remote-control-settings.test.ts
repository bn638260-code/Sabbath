import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  COMMAND_LOG_LIMIT,
  createCommandLogEntry,
  fetchRemoteStatuses,
  parseRemotePort,
  rotateRemoteHttpToken,
  toggleHttpServer,
  toggleOscServer,
} from "./use-remote-control-settings"

const mockInvoke = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => mockInvoke(...args),
}))

describe("use-remote-control-settings helpers", () => {
  beforeEach(() => {
    mockInvoke.mockReset()
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

  it("keeps the command log limit at 50 entries", () => {
    expect(COMMAND_LOG_LIMIT).toBe(50)
  })
})
