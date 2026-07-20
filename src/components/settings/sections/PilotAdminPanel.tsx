import { useCallback, useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  adminAddPilotChurch,
  adminCreatePilotInvite,
  adminGetPilot,
  adminRevokePilotInvite,
  adminRevokePilotMembership,
  adminSetPilotChurchStatus,
  adminUpdatePilot,
  type PilotAdminState,
  type PilotActionResult,
  type PilotRole,
  type PilotStatus,
} from "@/lib/supabase/pilot"

const SELECT_CLASS =
  "h-9 rounded-md border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)] px-3 text-sm"

export function PilotAdminPanel() {
  const [pilot, setPilot] = useState<PilotAdminState | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<PilotStatus>("draft")
  const [commencementDate, setCommencementDate] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  const [onboardingStarted, setOnboardingStarted] = useState(false)
  const [maxActiveChurches, setMaxActiveChurches] = useState(10)
  const [maxDevicesPerChurch, setMaxDevicesPerChurch] = useState(2)
  const [maxPilotDevices, setMaxPilotDevices] = useState(20)
  const [churchName, setChurchName] = useState("")
  const [primaryContactName, setPrimaryContactName] = useState("")
  const [primaryContactEmail, setPrimaryContactEmail] = useState("")
  const [districtPastor, setDistrictPastor] = useState("")
  const [inviteChurchId, setInviteChurchId] = useState("")
  const [inviteRole, setInviteRole] = useState<PilotRole>("operator")
  const [inviteExpiry, setInviteExpiry] = useState("")
  const [newCode, setNewCode] = useState<string | null>(null)

  const applyPilotResult = useCallback((result: Awaited<ReturnType<typeof adminGetPilot>>) => {
    if (!result.ok) toast.error(result.message)
    else {
      const next = result.pilot
      setPilot(next)
      setStatus(next.status)
      setCommencementDate(next.commencement_date ?? "")
      setExpiryDate(next.expiry_date ?? "")
      setPaymentConfirmed(Boolean(next.payment_confirmed_at))
      setOnboardingStarted(Boolean(next.onboarding_started_at))
      setMaxActiveChurches(next.max_active_churches)
      setMaxDevicesPerChurch(next.max_devices_per_church)
      setMaxPilotDevices(next.max_pilot_devices)
      setInviteChurchId((current) => current || next.churches[0]?.id || "")
    }
    setLoading(false)
  }, [])

  const load = useCallback(async () => {
    applyPilotResult(await adminGetPilot())
  }, [applyPilotResult])

  useEffect(() => {
    let cancelled = false
    void adminGetPilot().then((result) => {
      if (!cancelled) applyPilotResult(result)
    })
    return () => {
      cancelled = true
    }
  }, [applyPilotResult])

  async function savePilot() {
    if (
      !Number.isInteger(maxActiveChurches) ||
      !Number.isInteger(maxDevicesPerChurch) ||
      !Number.isInteger(maxPilotDevices) ||
      maxActiveChurches < 1 ||
      maxDevicesPerChurch < 1 ||
      maxPilotDevices < maxDevicesPerChurch
    ) {
      toast.error("Enter positive limits; total devices must cover at least one church.")
      return
    }
    setBusy(true)
    const result = await adminUpdatePilot({
      status,
      commencementDate: commencementDate || null,
      expiryDate: expiryDate || null,
      paymentConfirmed,
      onboardingStarted,
      maxActiveChurches,
      maxDevicesPerChurch,
      maxPilotDevices,
    })
    setBusy(false)
    if (!result.ok) return toast.error(result.message)
    toast.success("Pilot configuration saved.")
    await load()
  }

  async function addChurch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const result = await adminAddPilotChurch({
      name: churchName.trim(),
      primaryContactName: primaryContactName.trim(),
      primaryContactEmail: primaryContactEmail.trim(),
      districtPastor: districtPastor.trim(),
    })
    setBusy(false)
    if (!result.ok) return toast.error(result.message)
    setChurchName("")
    setPrimaryContactName("")
    setPrimaryContactEmail("")
    setDistrictPastor("")
    toast.success("Church added to Schedule A.")
    await load()
  }

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsedExpiry = new Date(inviteExpiry)
    if (Number.isNaN(parsedExpiry.getTime())) {
      toast.error("Enter a valid invitation expiry date and time.")
      return
    }
    setBusy(true)
    setNewCode(null)
    const result = await adminCreatePilotInvite(
      inviteChurchId,
      inviteRole,
      parsedExpiry.toISOString()
    )
    setBusy(false)
    if (!result.ok) return toast.error(result.message)
    setNewCode(result.code)
    toast.success("Single-use invitation created.")
    await load()
  }

  async function runAction(action: () => Promise<PilotActionResult>) {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (!result.ok) return toast.error(result.message)
    await load()
  }

  if (loading && !pilot) return <p className="text-xs text-muted-foreground">Loading KNFC pilot...</p>
  if (!pilot) return null

  const churchNameById = new Map(pilot.churches.map((church) => [church.id, church.name]))

  return (
    <div className="glass-panel space-y-5 p-4" data-tour="pilot-admin">
      <div>
        <p className="text-sm font-medium">KNFC pilot administration</p>
        <p className="text-xs text-muted-foreground">Draft access remains blocked until dates, payment, and onboarding are confirmed.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2" data-tour="pilot-activation">
        <label className="space-y-1 text-xs">Status
          <select className={`${SELECT_CLASS} block w-full`} value={status} onChange={(event) => setStatus(event.target.value as PilotStatus)}>
            <option value="draft">Draft</option><option value="active">Active</option>
            <option value="suspended">Suspended</option><option value="expired">Expired</option>
          </select>
        </label>
        <label className="space-y-1 text-xs">Commencement date<Input type="date" value={commencementDate} onChange={(event) => setCommencementDate(event.target.value)} /></label>
        <label className="space-y-1 text-xs">Expiry date<Input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></label>
        <div className="space-y-2 text-xs">
          <label className="flex gap-2"><input type="checkbox" checked={paymentConfirmed} onChange={(event) => setPaymentConfirmed(event.target.checked)} /> First payment received</label>
          <label className="flex gap-2"><input type="checkbox" checked={onboardingStarted} onChange={(event) => setOnboardingStarted(event.target.checked)} /> Onboarding commenced</label>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3" data-tour="pilot-limits">
        <label className="space-y-1 text-xs">Active churches
          <Input min={1} type="number" value={maxActiveChurches} onChange={(event) => setMaxActiveChurches(event.target.valueAsNumber)} />
        </label>
        <label className="space-y-1 text-xs">Devices per church
          <Input min={1} type="number" value={maxDevicesPerChurch} onChange={(event) => setMaxDevicesPerChurch(event.target.valueAsNumber)} />
        </label>
        <label className="space-y-1 text-xs">Devices across pilot
          <Input min={1} type="number" value={maxPilotDevices} onChange={(event) => setMaxPilotDevices(event.target.valueAsNumber)} />
        </label>
      </div>
      <Button size="sm" disabled={busy} onClick={() => void savePilot()}>Save pilot</Button>

      <form className="space-y-3 border-t border-[var(--border-subtle)] pt-4" data-tour="pilot-churches" onSubmit={(event) => void addChurch(event)}>
        <p className="text-sm font-medium">Add Schedule A church ({pilot.churches.filter((church) => church.status === "active").length}/{pilot.max_active_churches})</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input required placeholder="Church name" value={churchName} onChange={(event) => setChurchName(event.target.value)} />
          <Input placeholder="Primary contact name" value={primaryContactName} onChange={(event) => setPrimaryContactName(event.target.value)} />
          <Input type="email" placeholder="Primary contact email" value={primaryContactEmail} onChange={(event) => setPrimaryContactEmail(event.target.value)} />
          <Input placeholder="District pastor" value={districtPastor} onChange={(event) => setDistrictPastor(event.target.value)} />
        </div>
        <Button size="sm" disabled={busy || !churchName.trim()} type="submit">Add church</Button>
        <div className="space-y-2">
          {pilot.churches.map((church) => (
            <div key={church.id} className="flex items-center justify-between rounded-md border border-[var(--border-subtle)] p-2 text-xs">
              <span>{church.name} · {church.status}</span>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void runAction(() => adminSetPilotChurchStatus(church.id, church.status === "active" ? "replaced" : "active"))}>
                {church.status === "active" ? "Mark replaced" : "Restore"}
              </Button>
            </div>
          ))}
        </div>
      </form>

      <form className="space-y-3 border-t border-[var(--border-subtle)] pt-4" data-tour="pilot-invitations" onSubmit={(event) => void createInvite(event)}>
        <p className="text-sm font-medium">Create single-use invitation</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <select required aria-label="Invitation church" className={SELECT_CLASS} value={inviteChurchId} onChange={(event) => setInviteChurchId(event.target.value)}>
            <option value="">Select church</option>
            {pilot.churches.filter((church) => church.status === "active").map((church) => <option key={church.id} value={church.id}>{church.name}</option>)}
          </select>
          <select aria-label="Invitation role" className={SELECT_CLASS} value={inviteRole} onChange={(event) => setInviteRole(event.target.value as PilotRole)}>
            <option value="operator">Operator</option><option value="pastor">Pastor</option><option value="primary_contact">Primary contact</option>
          </select>
          <Input required aria-label="Invitation expiry" type="datetime-local" value={inviteExpiry} onChange={(event) => setInviteExpiry(event.target.value)} />
        </div>
        <Button size="sm" disabled={busy || !inviteChurchId || !inviteExpiry} type="submit">Generate invitation</Button>
        {newCode ? <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs"><p>Copy this code now. It will not be shown again.</p><code className="mt-1 block select-all text-sm font-semibold">{newCode}</code></div> : null}
        <div className="space-y-2">
          {pilot.invites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between rounded-md border border-[var(--border-subtle)] p-2 text-xs">
              <span>{churchNameById.get(invite.church_id)} · {invite.role} · {invite.redeemed_at ? "used" : invite.revoked_at ? "revoked" : "open"}</span>
              {!invite.redeemed_at && !invite.revoked_at ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void runAction(() => adminRevokePilotInvite(invite.id))}>Revoke</Button> : null}
            </div>
          ))}
        </div>
      </form>

      <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4" data-tour="pilot-memberships">
        <p className="text-sm font-medium">Pilot memberships</p>
        {pilot.memberships.map((membership) => (
          <div key={membership.user_id} className="flex items-center justify-between rounded-md border border-[var(--border-subtle)] p-2 text-xs">
            <span>{membership.email ?? membership.user_id} · {churchNameById.get(membership.church_id)} · {membership.role} · {membership.status}</span>
            {membership.status === "active" ? <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void runAction(() => adminRevokePilotMembership(membership.user_id))}>Revoke</Button> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
