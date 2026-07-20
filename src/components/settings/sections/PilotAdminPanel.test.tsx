// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PilotAdminPanel } from "./PilotAdminPanel"

const mockToastSuccess = vi.hoisted(() => vi.fn())
const mockToastError = vi.hoisted(() => vi.fn())
const mockAdminGetPilot = vi.hoisted(() => vi.fn())
const mockAdminCreatePilotInvite = vi.hoisted(() => vi.fn())
const mockAdminUpdatePilot = vi.hoisted(() => vi.fn())

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

vi.mock("@/lib/supabase/pilot", () => ({
  adminGetPilot: (...args: unknown[]) => mockAdminGetPilot(...args),
  adminCreatePilotInvite: (...args: unknown[]) => mockAdminCreatePilotInvite(...args),
  adminAddPilotChurch: vi.fn(),
  adminRevokePilotInvite: vi.fn(),
  adminRevokePilotMembership: vi.fn(),
  adminSetPilotChurchStatus: vi.fn(),
  adminUpdatePilot: (...args: unknown[]) => mockAdminUpdatePilot(...args),
}))

const pilot = {
  id: "pilot-1",
  name: "KNFC SabbathCue Pilot",
  status: "draft" as const,
  commencement_date: null,
  expiry_date: null,
  payment_confirmed_at: null,
  onboarding_started_at: null,
  max_active_churches: 10,
  max_devices_per_church: 2,
  max_pilot_devices: 20,
  churches: [
    {
      id: "church-1",
      name: "Central Church",
      primary_contact_name: null,
      primary_contact_email: null,
      district_pastor: null,
      status: "active" as const,
    },
  ],
  invites: [],
  memberships: [],
}

describe("PilotAdminPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminGetPilot.mockResolvedValue({ ok: true, pilot })
    mockAdminCreatePilotInvite.mockResolvedValue({
      ok: true,
      code: "KNFC-ONE-TIME-CODE-1234",
    })
    mockAdminUpdatePilot.mockResolvedValue({ ok: true })
  })

  afterEach(() => cleanup())

  it("creates and displays a single-use invitation for an active church", async () => {
    render(<PilotAdminPanel />)

    expect(await screen.findByText("KNFC pilot administration")).toBeTruthy()
    fireEvent.change(screen.getByLabelText("Invitation expiry"), {
      target: { value: "2026-08-01T10:00" },
    })
    await waitFor(() =>
      expect(
        (screen.getByRole("button", {
          name: "Generate invitation",
        }) as HTMLButtonElement).disabled
      ).toBe(false)
    )
    fireEvent.click(screen.getByRole("button", { name: "Generate invitation" }))

    await waitFor(() =>
      expect(mockAdminCreatePilotInvite).toHaveBeenCalledWith(
        "church-1",
        "operator",
        new Date("2026-08-01T10:00").toISOString()
      )
    )
    expect(await screen.findByText("KNFC-ONE-TIME-CODE-1234")).toBeTruthy()
    expect(mockToastSuccess).toHaveBeenCalledWith("Single-use invitation created.")
  })

  it("saves configurable agreement limits", async () => {
    render(<PilotAdminPanel />)
    await screen.findByText("KNFC pilot administration")

    fireEvent.change(screen.getByLabelText("Active churches"), {
      target: { value: "14" },
    })
    fireEvent.change(screen.getByLabelText("Devices per church"), {
      target: { value: "3" },
    })
    fireEvent.change(screen.getByLabelText("Devices across pilot"), {
      target: { value: "42" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save pilot" }))

    await waitFor(() =>
      expect(mockAdminUpdatePilot).toHaveBeenCalledWith(
        expect.objectContaining({
          maxActiveChurches: 14,
          maxDevicesPerChurch: 3,
          maxPilotDevices: 42,
        })
      )
    )
  })
})
