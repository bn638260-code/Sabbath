import { beforeEach, describe, expect, it, vi } from "vitest"

const mockInvoke = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock("@/hooks/use-transcription", () => ({
  transcriptionActions: {
    stop: vi.fn(),
    start: vi.fn(),
  },
}))

async function loadModules() {
  vi.resetModules()
  return import("./stt-key-settings")
}

describe("createProviderKeyActions", () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it("saves a provider key and verifies persistence", async () => {
    mockInvoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce(true)
    const { createProviderKeyActions } = await loadModules()
    const actions = createProviderKeyActions({
      label: "TestSTT",
      setCommand: "set_test_api_key",
      hasCommand: "has_test_api_key",
      clearCommand: "clear_test_api_key",
    })

    await expect(actions.saveApiKey("secret-key")).resolves.toEqual({
      hasKey: true,
    })
    expect(mockInvoke).toHaveBeenNthCalledWith(1, "set_test_api_key", {
      apiKey: "secret-key",
    })
    expect(mockInvoke).toHaveBeenNthCalledWith(2, "has_test_api_key")
  })

  it("returns a provider-specific error when the saved key is not persisted", async () => {
    mockInvoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce(false)
    const { createProviderKeyActions } = await loadModules()
    const actions = createProviderKeyActions({
      label: "TestSTT",
      setCommand: "set_test_api_key",
      hasCommand: "has_test_api_key",
      clearCommand: "clear_test_api_key",
    })

    await expect(actions.saveApiKey("bad-key")).resolves.toEqual({
      hasKey: false,
      error: "TestSTT API key was not saved",
    })
  })

  it("returns clear command failures without throwing", async () => {
    mockInvoke.mockRejectedValue(new Error("clear failed"))
    const { createProviderKeyActions } = await loadModules()
    const actions = createProviderKeyActions({
      label: "TestSTT",
      setCommand: "set_test_api_key",
      hasCommand: "has_test_api_key",
      clearCommand: "clear_test_api_key",
    })

    await expect(actions.clearApiKey()).resolves.toEqual({
      error: "Error: clear failed",
    })
    expect(mockInvoke).toHaveBeenCalledWith("clear_test_api_key")
  })
})
