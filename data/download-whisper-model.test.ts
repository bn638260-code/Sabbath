import { afterEach, describe, expect, it, vi } from "vitest"
import { fetchWithRetry } from "./download-whisper-model"

function makeFailedResponse(status: number, statusText: string) {
  return {
    ok: false,
    status,
    statusText,
    headers: new Headers(),
  }
}

describe("fetchWithRetry", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("makes all configured attempts before failing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeFailedResponse(429, "Too Many Requests"))
    const sleepMock = vi.fn().mockResolvedValue(undefined)

    vi.stubGlobal("fetch", fetchMock)

    await expect(
      fetchWithRetry("https://example.com/model.bin", {
        maxAttempts: 5,
        sleep: sleepMock,
      }),
    ).rejects.toThrow("Download failed: 429 Too Many Requests")

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(sleepMock).toHaveBeenCalledTimes(4)
  })

  it("fails immediately for non-retriable client errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(makeFailedResponse(404, "Not Found"))
    const sleepMock = vi.fn().mockResolvedValue(undefined)

    vi.stubGlobal("fetch", fetchMock)

    await expect(
      fetchWithRetry("https://example.com/model.bin", {
        maxAttempts: 5,
        sleep: sleepMock,
      }),
    ).rejects.toThrow("Download failed: 404 Not Found")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sleepMock).not.toHaveBeenCalled()
  })
})
