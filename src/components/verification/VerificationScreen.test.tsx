// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockSignUp = vi.fn().mockResolvedValue(undefined)

const verificationState = {
  status: "required",
  error: null,
  errorCode: null,
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

import { VerificationScreen } from "./VerificationScreen"

describe("VerificationScreen church organization signup", () => {
  let root: Root | null = null
  let container: HTMLDivElement | null = null

  beforeEach(async () => {
    vi.clearAllMocks()
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

  it("reveals the church name field and submits the self-declared profile", async () => {
    await click(button("Start trial"))

    expect(container?.textContent).not.toContain("Church name")
    await click(input("We are a church organization"))
    expect(container?.textContent).toContain("Church name")

    await type(input("Email"), "church@example.com")
    await type(input("Password"), "secret1")
    await type(input("Confirm password"), "secret1")
    await type(input("Church name"), "  Central SDA Church  ")
    await click(button("Start 14-day trial"))

    expect(mockSignUp).toHaveBeenCalledWith(
      "church@example.com",
      "secret1",
      {
        isChurchOrganization: true,
        churchName: "Central SDA Church",
      }
    )
  })

  it("requires a church name when the organization option is selected", async () => {
    await click(button("Start trial"))
    await click(input("We are a church organization"))
    await type(input("Email"), "church@example.com")
    await type(input("Password"), "secret1")
    await type(input("Confirm password"), "secret1")
    await click(button("Start 14-day trial"))

    expect(container?.querySelector('[role="alert"]')?.textContent).toContain(
      "Enter a church name between 2 and 120 characters."
    )
    expect(mockSignUp).not.toHaveBeenCalled()
  })
})
