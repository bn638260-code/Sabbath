export interface SignedActivationLease {
  payload: string
  signature: string
}

export interface ActivationLeaseClaims {
  version: 1
  userId: string
  deviceId: string
  issuedAt: number
  expiresAt: number
  accessExpiresAt: number | null
}

function decodeBase64(value: string, urlSafe = false): ArrayBuffer {
  const normalized = urlSafe
    ? value.replaceAll("-", "+").replaceAll("_", "/")
    : value
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  const binary = atob(padded)
  return Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0)
  ).buffer as ArrayBuffer
}

function parseClaims(payload: string): ActivationLeaseClaims | null {
  try {
    const value = JSON.parse(
      new TextDecoder().decode(decodeBase64(payload, true))
    ) as Record<string, unknown>
    if (
      value.version !== 1 ||
      typeof value.userId !== "string" ||
      typeof value.deviceId !== "string" ||
      typeof value.issuedAt !== "number" ||
      typeof value.expiresAt !== "number" ||
      !(
        value.accessExpiresAt === null ||
        typeof value.accessExpiresAt === "number"
      )
    ) {
      return null
    }
    return value as unknown as ActivationLeaseClaims
  } catch {
    return null
  }
}

export async function verifyActivationLeaseWithKey(
  lease: SignedActivationLease,
  publicKey: string,
  expectedUserId: string,
  expectedDeviceId: string,
  timestamp = Date.now()
): Promise<ActivationLeaseClaims | null> {
  const claims = parseClaims(lease.payload)
  if (
    !claims ||
    claims.userId !== expectedUserId ||
    claims.deviceId !== expectedDeviceId ||
    claims.expiresAt <= timestamp ||
    claims.issuedAt > timestamp + 60_000 ||
    (claims.accessExpiresAt !== null && claims.accessExpiresAt <= timestamp)
  ) {
    return null
  }
  try {
    const key = await crypto.subtle.importKey(
      "spki",
      decodeBase64(publicKey),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    )
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      decodeBase64(lease.signature, true),
      new TextEncoder().encode(lease.payload)
    )
    return valid ? claims : null
  } catch {
    return null
  }
}

export function verifyActivationLease(
  lease: SignedActivationLease,
  expectedUserId: string,
  expectedDeviceId: string,
  timestamp = Date.now()
): Promise<ActivationLeaseClaims | null> {
  const publicKey = import.meta.env.VITE_ACTIVATION_LEASE_PUBLIC_KEY
  if (!publicKey?.trim()) return Promise.resolve(null)
  return verifyActivationLeaseWithKey(
    lease,
    publicKey.trim(),
    expectedUserId,
    expectedDeviceId,
    timestamp
  )
}
