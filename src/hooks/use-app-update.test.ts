// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCheckForUpdate = vi.fn()
const mockDownloadAndInstallUpdate = vi.fn()
const mockGetAppVersion = vi.fn()
const mockRelaunchApp = vi.fn()

vi.mock("@/lib/updater", () => ({
  checkForUpdate: (...args: unknown[]) => mockCheckForUpdate(...args),
  downloadAndInstallUpdate: (...args: unknown[]) => mockDownloadAndInstallUpdate(...args),
  getAppVersion: (...args: unknown[]) => mockGetAppVersion(...args),
  relaunchApp: (...args: unknown[]) => mockRelaunchApp(...args),
}))

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriRuntime: () => true,
}))

describe("useAppUpdate", () => {
  beforeEach(() => {
    vi.resetModules()
    mockCheckForUpdate.mockReset()
    mockDownloadAndInstallUpdate.mockReset()
    mockGetAppVersion.mockReset()
    mockRelaunchApp.mockReset()
    mockGetAppVersion.mockResolvedValue("0.1.5")
  })

  it("reports available when a newer version exists", async () => {
    const update = { version: "0.1.5" }
    mockCheckForUpdate.mockResolvedValue({ ok: true, update })

    const { useAppUpdate } = await import("@/hooks/use-app-update")
    const { result } = renderHook(() => useAppUpdate())

    await act(async () => {
      const response = await result.current.check()
      expect(response.available).toBe(true)
    })

    expect(result.current.state.phase).toBe("available")
    expect(result.current.state.availableVersion).toBe("0.1.5")
  })

  it("silent auto-check logs failures without entering error phase", async () => {
    mockCheckForUpdate.mockResolvedValue({ ok: false, message: "offline" })
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    const { useAppUpdate } = await import("@/hooks/use-app-update")
    const { result } = renderHook(() => useAppUpdate())

    await act(async () => {
      await result.current.autoCheckOnce()
    })

    expect(result.current.state.phase).toBe("idle")
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it("install downloads, marks installed, and relaunches", async () => {
    mockCheckForUpdate.mockResolvedValue({
      ok: true,
      update: { version: "0.1.5" },
    })
    mockDownloadAndInstallUpdate.mockResolvedValue(undefined)
    mockRelaunchApp.mockResolvedValue(undefined)

    const { useAppUpdate } = await import("@/hooks/use-app-update")
    const { result } = renderHook(() => useAppUpdate())

    await act(async () => {
      await result.current.install()
    })

    expect(mockDownloadAndInstallUpdate).toHaveBeenCalled()
    expect(result.current.state.phase).toBe("installed")
    expect(mockRelaunchApp).toHaveBeenCalled()
  })
})
