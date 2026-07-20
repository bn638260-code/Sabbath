import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const migration = readFileSync(
  resolve(root, "supabase/migrations/010_knfc_pilot_access.sql"),
  "utf8"
)
const confirmationMigration = readFileSync(
  resolve(root, "supabase/migrations/011_confirmed_invites_and_admin_bootstrap.sql"),
  "utf8"
)
const limitsMigration = readFileSync(
  resolve(root, "supabase/migrations/012_configurable_pilot_limits.sql"),
  "utf8"
)

describe("KNFC pilot access migration contract", () => {
  it("stores only a digest of single-use invitation codes", () => {
    expect(migration).toContain("code_hash text NOT NULL UNIQUE")
    expect(migration).toContain("digest(upper(btrim(p_code)), 'sha256')")
    expect(migration).toContain("redeemed_at IS NULL")
    expect(migration).toContain("revoked_at IS NULL")
    expect(migration).toContain("v_invite.expires_at <= now()")
  })

  it("blocks participant activation until the pilot gates are satisfied", () => {
    expect(migration).toContain("p.status = 'active'")
    expect(migration).toContain("p.payment_confirmed_at IS NOT NULL")
    expect(migration).toContain("p.onboarding_started_at IS NOT NULL")
    expect(migration).toContain("p.commencement_date <= current_date")
    expect(migration).toContain("p.expiry_date >= current_date")
    expect(migration).toContain("'status', 'pilot_inactive'")
    expect(migration).toContain("'status', 'invite_required'")
  })

  it("enforces the church and pilot device limits server-side", () => {
    expect(migration).toContain("v_church_approved >= 2")
    expect(migration).toContain("v_pilot_approved >= 20")
    expect(migration).toContain("CREATE UNIQUE INDEX devices_church_device_unique")
  })

  it("keeps administration server-authorized and retires legacy extensions", () => {
    expect(migration).toContain("IF NOT public.is_app_admin()")
    expect(migration).toContain("TO service_role")
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.admin_set_access(uuid, integer) FROM authenticated"
    )
  })

  it("requires confirmed email and bootstraps only the designated admin email", () => {
    expect(confirmationMigration).toContain("email_confirmed_at IS NOT NULL")
    expect(confirmationMigration).toContain("'status', 'email_confirmation_required'")
    expect(confirmationMigration).toContain("lower(COALESCE(NEW.email, ''))")
    expect(confirmationMigration).toContain("INSERT INTO public.app_admins (user_id)")
  })

  it("stores and enforces adjustable agreement capacity", () => {
    expect(limitsMigration).toContain("max_active_churches integer NOT NULL DEFAULT 10")
    expect(limitsMigration).toContain("max_devices_per_church integer NOT NULL DEFAULT 2")
    expect(limitsMigration).toContain("max_pilot_devices integer NOT NULL DEFAULT 20")
    expect(limitsMigration).toContain("v_church_approved >= v_church_limit")
    expect(limitsMigration).toContain("v_pilot_approved >= v_pilot_limit")
    expect(limitsMigration).toContain("Pilot limits cannot be lower than current usage")
  })
})
