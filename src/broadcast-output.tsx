import { createRoot } from "react-dom/client"
import { useState } from "react"
import { useBroadcastOutputRuntime } from "@/hooks/use-broadcast-output-runtime"

/** Read output ID from URL query param (?output=main or ?output=alt). Defaults to "main". */
const outputId =
  new URLSearchParams(window.location.search).get("output") ?? "main"

function BroadcastCanvas() {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  useBroadcastOutputRuntime({ canvas, outputId })

  return (
    <canvas
      ref={setCanvas}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        display: "block",
        background: "#000",
        objectFit: "contain",
      }}
    />
  )
}

const root = document.getElementById("broadcast-root")!
createRoot(root).render(<BroadcastCanvas />)
