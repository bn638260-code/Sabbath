// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("tauri-runtime", () => {
  beforeEach(() => {
    vi.resetModules()
    delete (window as { __TAURI__?: unknown }).__TAURI__
    delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("treats test mode as a Tauri runtime", async () => {
    vi.stubEnv("MODE", "test")
    const { isTauriRuntime } = await import("./tauri-runtime")
    expect(isTauriRuntime()).toBe(true)
  })

  it("detects Tauri globals in the browser", async () => {
    vi.stubEnv("MODE", "development")
    ;(window as { __TAURI__?: unknown }).__TAURI__ = {}
    const { isTauriRuntime } = await import("./tauri-runtime")
    expect(isTauriRuntime()).toBe(true)
  })

  it("returns false outside Tauri in a normal browser", async () => {
    vi.stubEnv("MODE", "development")
    const { isTauriRuntime } = await import("./tauri-runtime")
    expect(isTauriRuntime()).toBe(false)
  })

  it("throws when invokeTauri is called outside the desktop runtime", async () => {
    vi.stubEnv("MODE", "development")
    const { invokeTauri } = await import("./tauri-runtime")
    await expect(invokeTauri("asset_status")).rejects.toThrow(
      'Tauri command "asset_status" is unavailable outside the desktop runtime.',
    )
  })
})
