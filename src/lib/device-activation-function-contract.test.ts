import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const edgeFunction = readFileSync(
  resolve(root, "supabase/functions/device-activation/index.ts"),
  "utf8"
)
const migration = readFileSync(
  resolve(root, "supabase/migrations/009_device_activation_management.sql"),
  "utf8"
)

describe("device activation deployment contract", () => {
  it("requires authenticated user context and verifies installation proof", () => {
    expect(edgeFunction).toContain('withSupabase({ auth: "user" }')
    expect(edgeFunction).toContain("verifyInstallationProof(body)")
    expect(edgeFunction).toContain("MAX_CHALLENGE_AGE_MS")
  })

  it("issues a signed lease capped at 72 hours", () => {
    expect(edgeFunction).toContain("const DEFAULT_OFFLINE_LEASE_HOURS = 72")
    expect(edgeFunction).toContain("leaseHours * 60 * 60 * 1000")
    expect(edgeFunction).toContain('Deno.env.get("ACTIVATION_LEASE_PRIVATE_KEY")')
    expect(edgeFunction).toContain("signature: await signLease(leasePayload)")
  })

  it("keeps revoked rows and counts only approved computers", () => {
    expect(migration).toContain("status IN ('pending', 'approved', 'revoked')")
    expect(migration).toContain("v_existing_status = 'revoked'")
    expect(migration).toContain("'status', 'device_revoked'")
    expect(migration).toContain("status = 'approved'")
    expect(migration).toContain("v_approved_count >= 2")
    expect(migration).toContain("approve_device_verified")
    expect(migration).toContain("TO service_role")
    expect(migration).toContain("FROM PUBLIC, anon, authenticated")
  })
})
