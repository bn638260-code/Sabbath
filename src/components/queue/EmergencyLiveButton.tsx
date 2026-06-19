import { SirenIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEmergencySlideStore } from "@/stores/emergency-slide-store"
import { useLibraryStore } from "@/stores/library-store"

interface EmergencyLiveButtonProps {
  className?: string
  label?: string
  size?: "xs" | "sm" | "default"
}

export function EmergencyLiveButton({
  className,
  label = "Emergency",
  size = "sm",
}: EmergencyLiveButtonProps) {
  const selectedAssetId = useEmergencySlideStore((s) => s.selectedAssetId)
  const presentEmergency = useEmergencySlideStore((s) => s.presentEmergency)
  const selectedAsset = useLibraryStore((s) =>
    s.assets.find((asset) => asset.id === selectedAssetId)
  )

  const handleSendEmergency = () => {
    if (presentEmergency()) return
    toast.error("Emergency slide unavailable", {
      description: "Choose an emergency item from the Queue workspace.",
    })
  }

  return (
    <Button
      type="button"
      size={size}
      variant="destructive"
      className={cn("gap-2", className)}
      disabled={!selectedAsset}
      title={
        selectedAsset
          ? `Send ${selectedAsset.name} to Live Output`
          : "Choose an emergency item from the Queue workspace"
      }
      onClick={handleSendEmergency}
    >
      <SirenIcon className="size-3.5" />
      {label}
    </Button>
  )
}
