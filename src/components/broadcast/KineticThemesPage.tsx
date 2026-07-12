import { lazy, Suspense, useMemo, useState } from "react"
import {
  CheckCircleIcon,
  EditIcon,
  PaletteIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
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

function ThemeCatalogCard({
  theme,
  active,
  onApply,
  onDelete,
  onEdit,
}: {
  theme: BroadcastTheme
  active: boolean
  onApply: () => void
  onDelete?: () => void
  onEdit: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const isKinetic = Boolean(theme.kinetic)

  return (
    <article
      className={cn(
        "group flex h-full min-h-[236px] flex-col overflow-hidden rounded-lg border bg-[var(--bg-surface)] transition-colors",
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
          animate={isKinetic && (active || hovered)}
        />
        {isKinetic ? (
          <Badge className="absolute top-2 left-2 bg-indigo-600 text-foreground hover:bg-indigo-600">
            Kinetic
          </Badge>
        ) : (
          <Badge className="absolute top-2 left-2 bg-slate-700 text-foreground hover:bg-slate-700">
            Static
          </Badge>
        )}
        {active ? (
          <Badge className="absolute top-2 right-2 bg-emerald-600 text-foreground hover:bg-emerald-600">
            Active
          </Badge>
        ) : null}
      </div>

      <div className="flex min-h-[88px] flex-1 items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {theme.name}
          </h2>
          <p className="mt-1 line-clamp-2 min-h-[2rem] text-[0.6875rem] leading-4 text-muted-foreground">
            {isKinetic
              ? `${theme.kinetic?.backgroundKind ?? "motion"} / ${
                  theme.kinetic?.motion.durationMs
                    ? `${Math.round(theme.kinetic.motion.durationMs / 1000)}s`
                    : "loop"
                }`
              : theme.builtin
                ? "Static built-in theme"
                : "Static custom theme"}
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
        {onDelete ? (
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label={`Delete ${theme.name}`}
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2Icon className="size-4" />
          </Button>
        ) : null}
      </div>
    </article>
  )
}

export function KineticThemesPage() {
  const themes = useBroadcastThemeStore((s) => s.themes)
  const activeThemeId = useBroadcastThemeStore((s) => s.activeThemeId)
  const [search, setSearch] = useState("")
  const [designerMounted, setDesignerMounted] = useState(false)

  const filteredThemes = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return themes
    return themes.filter((theme) => theme.name.toLowerCase().includes(query))
  }, [themes, search])

  const staticThemes = filteredThemes.filter((theme) => !theme.kinetic)
  const kineticThemes = filteredThemes.filter((theme) => Boolean(theme.kinetic))
  const totalStaticThemes = themes.filter((theme) => !theme.kinetic).length
  const totalKineticThemes = themes.filter((theme) =>
    Boolean(theme.kinetic)
  ).length
  const activeTheme = themes.find((theme) => theme.id === activeThemeId) ?? null

  const applyTheme = (themeId: string) => {
    useBroadcastThemeStore.getState().setActiveTheme(themeId)
  }

  const editTheme = (themeId: string) => {
    setDesignerMounted(true)
    const designer = useBroadcastDesignerStore.getState()
    designer.startEditing(themeId)
    designer.setDesignerOpen(true)
  }

  const deleteTheme = (themeId: string) => {
    useBroadcastThemeStore.getState().deleteTheme(themeId)
  }

  return (
    <div
      className="view-pane flex min-h-[calc(100vh-136px)] flex-col gap-4"
      data-tour="kinetic-themes"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--shell-bg-sunken)]">
            <PaletteIcon className="size-5 text-[var(--accent)]" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground">
              Themes
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline">{totalStaticThemes} static</Badge>
              <Badge variant="outline">{totalKineticThemes} kinetic</Badge>
              {activeTheme ? (
                <Badge variant="outline">{activeTheme.name}</Badge>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative w-full max-w-xs">
          <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search themes"
            placeholder="Search themes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="grid min-w-0 flex-1 gap-4 lg:grid-cols-2">
        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PaletteIcon className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Static</h2>
            </div>
            <Badge variant="outline">{staticThemes.length}</Badge>
          </div>
          <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
            {staticThemes.map((theme) => (
              <ThemeCatalogCard
                key={theme.id}
                theme={theme}
                active={theme.id === activeThemeId}
                onApply={() => applyTheme(theme.id)}
                onEdit={() => editTheme(theme.id)}
                onDelete={
                  theme.builtin ? undefined : () => deleteTheme(theme.id)
                }
              />
            ))}
          </div>
          {staticThemes.length === 0 ? (
            <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-sm text-muted-foreground">
              No static themes found
            </p>
          ) : null}
        </section>

        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Kinetic</h2>
            </div>
            <Badge variant="outline">{kineticThemes.length}</Badge>
          </div>
          <div className="grid auto-rows-fr gap-3 sm:grid-cols-2">
            {kineticThemes.map((theme) => (
              <ThemeCatalogCard
                key={theme.id}
                theme={theme}
                active={theme.id === activeThemeId}
                onApply={() => applyTheme(theme.id)}
                onEdit={() => editTheme(theme.id)}
                onDelete={
                  theme.builtin ? undefined : () => deleteTheme(theme.id)
                }
              />
            ))}
          </div>
          {kineticThemes.length === 0 ? (
            <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-sm text-muted-foreground">
              No kinetic themes found
            </p>
          ) : null}
        </section>
      </div>

      {designerMounted ? (
        <Suspense fallback={null}>
          <LazyThemeDesigner />
        </Suspense>
      ) : null}
    </div>
  )
}
