// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockSignUp = vi.fn().mockResolvedValue(undefined)
const mockRedeemPilotInvite = vi.fn()

const verificationState = {
  status: "required",
  error: null,
  errorCode: null as string | null,
  verifiedEmail: null,
  signIn: vi.fn(),
  signUp: mockSignUp,
  signOut: vi.fn(),
  refresh: vi.fn(),
}

vi.mock("@/stores/verification-store", () => {
  const useVerificationStore = (
    selector: (state: typeof verificationState) => unknown
  ) => selector(verificationState)
  useVerificationStore.getState = () => verificationState
  return { useVerificationStore }
})

vi.mock("@/stores/accent-theme-store", () => ({
  accentThemeClassName: () => "",
  useAccentThemeStore: (selector: (state: { theme: string }) => unknown) =>
    selector({ theme: "amber" }),
}))

vi.mock("@/lib/supabase/pilot", () => ({
  redeemPilotInvite: (...args: unknown[]) => mockRedeemPilotInvite(...args),
}))

import { VerificationScreen } from "./VerificationScreen"

describe("VerificationScreen account signup", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(async () => {
    vi.clearAllMocks()
    verificationState.status = "required"
    verificationState.error = null
    verificationState.errorCode = null
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(<VerificationScreen />)
    })
  })

  afterEach(async () => {
    await act(async () => root?.unmount())
    container?.remove()
    root = null
    container = null
  })

  function button(text: string): HTMLButtonElement {
    const match = Array.from(
      container?.querySelectorAll<HTMLButtonElement>("button") ?? []
    ).find((candidate) => candidate.textContent?.trim() === text)
    expect(match).toBeTruthy()
    return match as HTMLButtonElement
  }

  function input(label: string): HTMLInputElement {
    const labelElement = Array.from(
      container?.querySelectorAll<HTMLLabelElement>("label") ?? []
    ).find((candidate) => candidate.textContent?.includes(label))
    const match = labelElement?.querySelector<HTMLInputElement>("input")
    expect(match).toBeTruthy()
    return match as HTMLInputElement
  }

  async function click(element: HTMLElement): Promise<void> {
    await act(async () => {
      element.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true })
      )
    })
  }

  async function type(element: HTMLInputElement, value: string): Promise<void> {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set
      setter?.call(element, value)
      element.dispatchEvent(new Event("input", { bubbles: true }))
    })
  }

  it("creates an account without granting a self-declared church", async () => {
    await click(button("Register"))
    await type(input("Email"), "church@example.com")
    await type(input("Password"), "secret1")
    await type(input("Confirm password"), "secret1")
    await click(button("Create account"))

    expect(mockSignUp).toHaveBeenCalledWith("church@example.com", "secret1")
  })

  it("requires matching passwords", async () => {
    await click(button("Register"))
    await type(input("Email"), "church@example.com")
    await type(input("Password"), "secret1")
    await type(input("Confirm password"), "different")
    await click(button("Create account"))

    expect(container?.querySelector('[role="alert"]')?.textContent).toContain(
      "Passwords do not match."
    )
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it("redeems an invitation only with training acknowledgement", async () => {
    verificationState.status = "error"
    verificationState.errorCode = "invite_required"
    mockRedeemPilotInvite.mockResolvedValue({ ok: true })
    await act(async () => root?.render(<VerificationScreen />))

    await type(input("Invitation code"), "KNFCINVITECODE1234")
    await click(input("completed or reviewed"))
    await click(button("Redeem invitation"))

    expect(mockRedeemPilotInvite).toHaveBeenCalledWith("KNFCINVITECODE1234", true)
    expect(verificationState.refresh).toHaveBeenCalled()
  })
})
