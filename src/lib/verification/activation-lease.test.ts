import { describe, expect, it } from "vitest"
import {
  verifyActivationLeaseWithKey,
  type SignedActivationLease,
} from "@/lib/verification/activation-lease"

function encodeBase64(value: Uint8Array, urlSafe = false): string {
  let binary = ""
  for (const byte of value) binary += String.fromCharCode(byte)
  const encoded = btoa(binary)
  return urlSafe
    ? encoded.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")
    : encoded
}

async function createLease(
  overrides: Partial<{
    userId: string
    deviceId: string
    issuedAt: number
    expiresAt: number
    accessExpiresAt: number | null
  }> = {}
): Promise<{ lease: SignedActivationLease; publicKey: string }> {
  const now = Date.now()
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  )
  const payload = encodeBase64(
    new TextEncoder().encode(
      JSON.stringify({
        version: 1,
        userId: "user-1",
        deviceId: "device-1",
        issuedAt: now - 1_000,
        expiresAt: now + 60_000,
        accessExpiresAt: now + 60_000,
        ...overrides,
      })
    ),
    true
  )
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keyPair.privateKey,
    new TextEncoder().encode(payload)
  )
  return {
    lease: {
      payload,
      signature: encodeBase64(new Uint8Array(signature), true),
    },
    publicKey: encodeBase64(
      new Uint8Array(await crypto.subtle.exportKey("spki", keyPair.publicKey))
    ),
  }
}

describe("activation lease verification", () => {
  it("accepts a valid lease for the expected user and installation", async () => {
    const { lease, publicKey } = await createLease()

    const result = await verifyActivationLeaseWithKey(
      lease,
      publicKey,
      "user-1",
      "device-1"
    )

    expect(result).toEqual(
      expect.objectContaining({ userId: "user-1", deviceId: "device-1" })
    )
  })

  it("rejects a lease copied to another installation", async () => {
    const { lease, publicKey } = await createLease()

    await expect(
      verifyActivationLeaseWithKey(lease, publicKey, "user-1", "device-2")
    ).resolves.toBeNull()
  })

  it("rejects an expired signed lease", async () => {
    const now = Date.now()
    const { lease, publicKey } = await createLease({
      expiresAt: now - 1,
      accessExpiresAt: now + 60_000,
    })

    await expect(
      verifyActivationLeaseWithKey(
        lease,
        publicKey,
        "user-1",
        "device-1",
        now
      )
    ).resolves.toBeNull()
  })
})
