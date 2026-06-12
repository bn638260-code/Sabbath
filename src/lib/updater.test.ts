import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCheck = vi.fn()
const mockGetVersion = vi.fn()
const mockDownloadAndInstall = vi.fn()
const mockRelaunch = vi.fn()

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: (...args: unknown[]) => mockCheck(...args),
}))

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: (...args: unknown[]) => mockGetVersion(...args),
}))

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: (...args: unknown[]) => mockRelaunch(...args),
}))

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriRuntime: () => true,
}))

describe("updater", () => {
  beforeEach(() => {
    vi.resetModules()
    mockCheck.mockReset()
    mockGetVersion.mockReset()
    mockDownloadAndInstall.mockReset()
    mockRelaunch.mockReset()
  })

  it("returns the app version from Tauri", async () => {
    mockGetVersion.mockResolvedValue("0.1.5")
    const { getAppVersion } = await import("@/lib/updater")
    await expect(getAppVersion()).resolves.toBe("0.1.5")
  })

  it("returns null update when check finds nothing new", async () => {
    mockCheck.mockResolvedValue(null)
    const { checkForUpdate } = await import("@/lib/updater")
    await expect(checkForUpdate()).resolves.toEqual({ ok: true, update: null })
  })

  it("returns an update object when check finds a newer version", async () => {
    const update = { version: "0.1.5", downloadAndInstall: mockDownloadAndInstall }
    mockCheck.mockResolvedValue(update)
    const { checkForUpdate } = await import("@/lib/updater")
    await expect(checkForUpdate()).resolves.toEqual({ ok: true, update })
  })

  it("surfaces check failures", async () => {
    mockCheck.mockRejectedValue(new Error("network down"))
    const { checkForUpdate } = await import("@/lib/updater")
    await expect(checkForUpdate()).resolves.toEqual({
      ok: false,
      message: "network down",
    })
  })

  it("relaunches through the process plugin", async () => {
    mockRelaunch.mockResolvedValue(undefined)
    const { relaunchApp } = await import("@/lib/updater")
    await relaunchApp()
    expect(mockRelaunch).toHaveBeenCalled()
  })
})
