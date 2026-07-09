// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useLibraryStore } from "@/stores/library-store"
import { useQueueStore } from "@/stores/queue-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import type { LibraryAsset } from "@/types/library"
import { LibraryWorkspace } from "./LibraryWorkspace"

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}))

function imageAsset(
  id: string,
  name: string,
  collectionIds: string[],
  importOrder: number,
): LibraryAsset {
  return {
    id,
    name,
    type: "image",
    collectionIds,
    fileName: `${id}.png`,
    width: 1920,
    height: 1080,
    mimeType: "image/png",
    thumbnail: `data:image/png;base64,${id}`,
    importOrder,
    createdAt: 1,
    updatedAt: 1,
  }
}

function renderWorkspace() {
  return render(
    <TooltipProvider>
      <LibraryWorkspace />
    </TooltipProvider>,
  )
}

describe("LibraryWorkspace", () => {
  const addItem = vi.fn()

  beforeEach(() => {
    addItem.mockReset()
    useQueueStore.getState().clearQueue()
    useLibraryStore.setState({
      assets: [
        imageAsset("welcome", "Welcome Background", ["collection-1"], 2),
        imageAsset("offering", "Offering Background", [], 1),
      ],
      collections: [
        {
          id: "collection-1",
          name: "Easter",
          assetIds: ["welcome"],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    })
    useServicePlanStore.setState({ addItem })
  })

  afterEach(() => {
    cleanup()
  })

  it("filters visible assets by search query", () => {
    renderWorkspace()

    fireEvent.change(screen.getByPlaceholderText("Search library"), {
      target: { value: "offering" },
    })

    expect(screen.getByText("Offering Background")).toBeTruthy()
    expect(screen.queryByText("Welcome Background")).toBeNull()
    expect(screen.getByText("1 of 2 assets")).toBeTruthy()
  })

  it("shows assets by import number and queues visible assets in import order", () => {
    const { container } = renderWorkspace()

    const text = container.textContent ?? ""
    expect(text.indexOf("#001")).toBeLessThan(text.indexOf("#002"))
    expect(text.indexOf("Offering Background")).toBeLessThan(
      text.indexOf("Welcome Background")
    )

    fireEvent.click(screen.getByRole("button", { name: /queue visible/i }))

    expect(
      useQueueStore.getState().items.map((item) => item.presentation.reference)
    ).toEqual(["Offering Background", "Welcome Background"])
  })

  it("adds the selected collection assets to the service plan", () => {
    renderWorkspace()

    fireEvent.focus(screen.getByLabelText("Rename Easter"))
    fireEvent.click(screen.getByRole("button", { name: /add collection to plan/i }))

    expect(addItem).toHaveBeenCalledTimes(1)
    expect(addItem.mock.calls[0][0]).toMatchObject({
      title: "Welcome Background",
      kind: "media",
    })
  })
})
