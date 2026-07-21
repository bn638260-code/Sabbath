import { describe, it, expect, vi, beforeEach } from "vitest"
import { toast } from "sonner"
import { notifyAction } from "@/lib/action-notifications"
import { useSettingsStore } from "@/stores/settings-store"

vi.mock("sonner", () => ({ toast: vi.fn() }))

describe("notifyAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({ actionNotificationsEnabled: false })
  })

  it("stays silent when action notifications are disabled", () => {
    notifyAction("Sent to live", "John 3:16")
    expect(toast).not.toHaveBeenCalled()
  })

  it("shows a toast with a description when enabled", () => {
    useSettingsStore.setState({ actionNotificationsEnabled: true })
    notifyAction("Sent to live", "John 3:16")
    expect(toast).toHaveBeenCalledWith("Sent to live", {
      description: "John 3:16",
    })
  })

  it("omits toast options when no description is given", () => {
    useSettingsStore.setState({ actionNotificationsEnabled: true })
    notifyAction("Queue cleared")
    expect(toast).toHaveBeenCalledWith("Queue cleared", undefined)
  })
})
