import type { LucideIcon } from "lucide-react"
import {
  BookOpenIcon,
  ClipboardListIcon,
  LibraryIcon,
  LayoutGridIcon,
  ListOrderedIcon,
  PlayCircleIcon,
  RadarIcon,
  RadioIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  LifeBuoyIcon,
} from "lucide-react"
import type { DashboardWorkspace } from "@/stores/dashboard-workspace-store"

export type DashboardWorkspaceNavItem = {
  id: DashboardWorkspace
  label: string
  icon: LucideIcon
  /** Insert a divider before this item in the workspace navigation. */
  dividerBefore?: boolean
  opensPlanner?: boolean
  /** Keyboard shortcut shown in the top-navigation icon tooltip, when one exists. */
  shortcut?: string
}

/** Workspace navigation order, rendered as icon-first buttons in the top navigation. */
export const DASHBOARD_WORKSPACE_NAV: DashboardWorkspaceNavItem[] = [
  {
    id: "live",
    label: "Live Desk",
    icon: LayoutGridIcon,
    shortcut: "Ctrl/Cmd + 1",
  },
  {
    id: "detections",
    label: "Detections",
    icon: RadarIcon,
    shortcut: "Ctrl/Cmd + 7",
  },
  {
    id: "scripture-search",
    label: "Scripture & EGW",
    icon: SearchIcon,
    shortcut: "Ctrl/Cmd + 8",
  },
  {
    id: "queue",
    label: "Queue",
    icon: ListOrderedIcon,
    shortcut: "Ctrl/Cmd + 6",
  },
  {
    id: "run-service",
    label: "Run Service Flow",
    icon: PlayCircleIcon,
    shortcut: "Ctrl/Cmd + 3",
  },
  {
    id: "service-plans",
    label: "Service Schedules",
    icon: ClipboardListIcon,
    opensPlanner: true,
    shortcut: "Ctrl/Cmd + 2",
  },
  { id: "live-service", label: "Broadcast Control", icon: RadioIcon },
  { id: "kinetic-themes", label: "Themes", icon: SparklesIcon },
  {
    id: "hymns",
    label: "SDA Hymns Search",
    icon: BookOpenIcon,
    dividerBefore: true,
    shortcut: "Ctrl/Cmd + 4",
  },
  {
    id: "library",
    label: "Church Library",
    icon: LibraryIcon,
    shortcut: "Ctrl/Cmd + 5",
  },
  {
    id: "settings",
    label: "System Settings",
    icon: SettingsIcon,
    dividerBefore: true,
  },
  { id: "help-legal", label: "Help & Legal", icon: LifeBuoyIcon },
]

export function workspaceNavLabel(id: DashboardWorkspace): string {
  return DASHBOARD_WORKSPACE_NAV.find((item) => item.id === id)?.label ?? id
}
