import { lazy, Suspense, useMemo, useState } from "react"
import {
  CheckCircleIcon,
  EditIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CanvasVerse } from "@/components/ui/canvas-verse"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useBroadcastDesignerStore } from "@/stores/broadcast/designer-store"
import { useBroadcastThemeStore } from "@/stores/broadcast/theme-store"
import type { BroadcastTheme, VerseRenderData } from "@/types"

const LazyThemeDesigner = lazy(() =>
  import("@/components/broadcast/theme-designer").then((mod) => ({
    default: mod.ThemeDesigner,
  }))
)

const PREVIEW_VERSE: VerseRenderData = {
  reference: "Psalm 96:1 (KJV)",
  segments: [{ text: "Sing unto the Lord a new song" }],
}

function KineticThemeCard({
  theme,
  active,
  onApply,
  onEdit,
}: {
  theme: BroadcastTheme
  active: boolean
  onApply: () => void
  onEdit: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-lg border bg-[var(--bg-surface)] transition-colors",
        active
          ? "border-[var(--accent-border)] ring-1 ring-[var(--accent)]/35"
          : "border-[var(--border-subtle)] hover:border-[var(--accent-border)]"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative aspect-video overflow-hidden">
        <CanvasVerse
          theme={theme}
          verse={PREVIEW_VERSE}
          className="h-full w-full"
          animate={active || hovered}
        />
        <Badge className="absolute top-2 left-2 bg-indigo-600 text-foreground hover:bg-indigo-600">
          Kinetic
        </Badge>
        {active ? (
          <Badge className="absolute top-2 right-2 bg-emerald-600 text-foreground hover:bg-emerald-600">
            Active
          </Badge>
        ) : null}
      </div>

      <div className="flex items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {theme.name}
          </h2>
          <p className="truncate text-[0.6875rem] text-muted-foreground">
            {theme.kinetic?.backgroundKind ?? "motion"} /{" "}
            {theme.kinetic?.motion.durationMs
              ? `${Math.round(theme.kinetic.motion.durationMs / 1000)}s`
              : "loop"}
          </p>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant={active ? "default" : "outline"}
          aria-label={`Apply ${theme.name}`}
          onClick={onApply}
        >
          <CheckCircleIcon className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          aria-label={`Edit ${theme.name}`}
          onClick={onEdit}
        >
          <EditIcon className="size-4" />
        </Button>
      </div>
    </article>
  )
}

export function KineticThemesPage() {
  const themes = useBroadcastThemeStore((s) => s.themes)
  const activeThemeId = useBroadcastThemeStore((s) => s.activeThemeId)
  const [search, setSearch] = useState("")
  const [designerMounted, setDesignerMounted] = useState(false)

  const kineticThemes = useMemo(
    () => themes.filter((theme) => Boolean(theme.kinetic)),
    [themes]
  )
  const filteredThemes = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return kineticThemes
    return kineticThemes.filter((theme) =>
      theme.name.toLowerCase().includes(query)
    )
  }, [kineticThemes, search])

  const activeKineticTheme =
    kineticThemes.find((theme) => theme.id === activeThemeId) ??
    kineticThemes[0] ??
    null

  const applyTheme = (themeId: string) => {
    useBroadcastThemeStore.getState().setActiveTheme(themeId)
  }

  const editTheme = (themeId: string) => {
    setDesignerMounted(true)
    const designer = useBroadcastDesignerStore.getState()
    designer.startEditing(themeId)
    designer.setDesignerOpen(true)
  }

  return (
    <div
      className="view-pane flex min-h-[calc(100vh-136px)] flex-col gap-4"
      data-tour="kinetic-themes"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)]">
            <SparklesIcon className="size-5 text-[var(--accent)]" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground">
              Kinetic Themes
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline">{kineticThemes.length} presets</Badge>
              {activeKineticTheme ? (
                <Badge variant="outline">{activeKineticTheme.name}</Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative w-full max-w-xs">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search kinetic themes"
            placeholder="Search kinetic themes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {activeKineticTheme ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="min-w-0 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <CanvasVerse
              theme={activeKineticTheme}
              verse={PREVIEW_VERSE}
              className="aspect-video w-full"
              animate
            />
          </div>

          <div className="grid min-w-0 content-start gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {filteredThemes.map((theme) => (
              <KineticThemeCard
                key={theme.id}
                theme={theme}
                active={theme.id === activeThemeId}
                onApply={() => applyTheme(theme.id)}
                onEdit={() => editTheme(theme.id)}
              />
            ))}
            {filteredThemes.length === 0 ? (
              <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-sm text-muted-foreground">
                No kinetic themes found
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-sm text-muted-foreground">
          No kinetic themes found
        </p>
      )}

      {designerMounted ? (
        <Suspense fallback={null}>
          <LazyThemeDesigner />
        </Suspense>
      ) : null}
    </div>
  )
}
