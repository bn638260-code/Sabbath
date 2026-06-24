// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest"

const mockOpenUrl = vi.fn()

vi.mock("@/lib/tauri-runtime", () => ({
  isTauriRuntime: () => true,
}))

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: (...args: unknown[]) => mockOpenUrl(...args),
}))

describe("support-contact", () => {
  beforeEach(() => {
    mockOpenUrl.mockReset()
  })

  it("builds a mailto URL for support with encoded subject and body", async () => {
    const { SUPPORT_EMAIL, buildSupportEmailUrl } =
      await import("@/lib/support-contact")

    const url = buildSupportEmailUrl({
      subject: "Access renewal",
      body: "Please renew my account.",
    })

    expect(url).toBe(
      `mailto:${SUPPORT_EMAIL}?subject=Access+renewal&body=Please+renew+my+account.`
    )
  })

  it("opens support mail through the Tauri opener when available", async () => {
    mockOpenUrl.mockResolvedValue(undefined)

    const { openSupportEmail } = await import("@/lib/support-contact")
    await openSupportEmail("Access renewal")

    expect(mockOpenUrl).toHaveBeenCalledWith(
      "mailto:fanelesibonge50@gmail.com?subject=Access+renewal"
    )
  })

  it("defines the standard and annual renewal options", async () => {
    const { RENEWAL_PLANS } = await import("@/lib/support-contact")

    expect(RENEWAL_PLANS).toEqual([
      expect.objectContaining({
        id: "standard",
        name: "Standard",
        price: "R250",
        term: "per month",
      }),
      expect.objectContaining({
        id: "annual",
        name: "Annual",
        price: "R2,500",
        term: "per year",
      }),
    ])
  })

  it("builds a renewal email template with the selected plan", async () => {
    const { buildRenewalEmailOptions, buildSupportEmailUrl } =
      await import("@/lib/support-contact")

    const options = buildRenewalEmailOptions("annual", {
      accountEmail: "media@example.com",
    })
    const url = buildSupportEmailUrl(options)

    expect(options.subject).toBe("SabbathCue Annual renewal")
    expect(options.body).toContain("Selected plan: Annual - R2,500/year")
    expect(options.body).toContain("Account email: media@example.com")
    expect(options.body).toContain("Payment/reference:\nChurch name:")
    expect(url).toContain("subject=SabbathCue+Annual+renewal")
  })

  it("builds a cancellation request with the access disclaimer", async () => {
    const { buildCancellationEmailOptions, buildSupportEmailUrl } =
      await import("@/lib/support-contact")

    const options = buildCancellationEmailOptions({
      accountEmail: "media@example.com",
    })
    const url = buildSupportEmailUrl(options)

    expect(options.subject).toBe("SabbathCue cancellation request")
    expect(options.body).toContain(
      "Please cancel my SabbathCue subscription/renewal."
    )
    expect(options.body).toContain("Account email: media@example.com")
    expect(options.body).toContain(
      "does not refund the current paid period"
    )
    expect(options.body).toContain(
      "access remains active until the subscribed period ends"
    )
    expect(options.body).toContain(
      "access will be disabled unless I renew"
    )
    expect(url).toContain("subject=SabbathCue+cancellation+request")
  })
})
