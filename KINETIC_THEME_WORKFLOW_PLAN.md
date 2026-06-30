# CODING AGENT PLAN
### Checkpoint-Based Plan for Kinetic SabbathCue Themes

---

## PLAN METADATA

| Field | Value |
|---|---|
| **Plan Name** | `Kinetic Theme Workflow from SabbathCue HTML Prototype` |
| **Version** | `v1.4-derived` |
| **Agent ID / Session** | `Codex / 2026-06-30` |
| **Codebase / Repo** | `C:\Users\fanel\Downloads\rhema-main\rhema-main` |
| **Language / Stack** | `TypeScript + React + Vite + Tauri + Zustand + Canvas` |
| **Plan Author** | `Codex draft for Fanel` |
| **Date Created** | `2026-06-30` |
| **Completion Target** | `TBD by operator` |

---

## SOURCE ANALYSIS

### Source file analyzed

`C:\Users\fanel\Downloads\sabbathcue_live_presentation_controller_v2 (5).html`

### Theme behavior found in the HTML

The HTML prototype defines a global "Kinetic Theme" selector that applies one selected theme to multiple projection canvases:

- `previewSlidePanel`
- `liveSlidePanel`
- `hymnPreviewDisplay`
- `designerSlidePanel`
- matching text and reference elements

The key function is `applyGlobalTheme(themeValue)`, which:

- stores the selected `globalSlideTheme`
- removes existing `slide-theme-*`, `font-*`, and `animate-*` classes
- adds the selected theme class
- adds the selected font class
- adds `animate-mesh-vigorous`
- applies reference-label tracking classes

The motion system is CSS-driven:

- `liquidMesh`: shifts background position and hue/saturation
- `vigorousDrift`: moves large blurred ambient blobs
- `cyberPulse`: opacity and scale pulsing
- `slowSpin`: rotation
- `gridScroll`: grid background scrolling
- `animate-mesh-vigorous`: 6-second animated mesh background
- `animate-drift-vigorous`: 10-second ambient blob drift

### Theme catalog found in the HTML

Classical serif / fluid wave themes:

| ID | Label | Theme class | Font intent |
|---|---|---|---|
| `ocean` | Midnight Ocean | `slide-theme-ocean` | Instrument Serif |
| `cathedral` | Cathedral Gold | `slide-theme-cathedral` | Cinzel |
| `monastery` | Sacred Monastery | `slide-theme-monastery` | Cormorant Garamond |
| `renaissance` | Burgundy Velvet | `slide-theme-renaissance` | Bodoni Moda |
| `celestial` | Celestial Deep | `slide-theme-celestial` | Instrument Serif |
| `editorial` | Editorial Canvas | `slide-theme-editorial` | Playfair Display |
| `parchment` | Aged Parchment | `slide-theme-parchment` | Cormorant Garamond |
| `royal` | Imperial Purple | `slide-theme-royal` | Instrument Serif |

Modern sans / geometric active motion themes:

| ID | Label | Theme class | Font intent |
|---|---|---|---|
| `cyberpunk` | Neon Synthwave | `slide-theme-cyberpunk` | Unbounded |
| `nordic` | Nordic Frost | `slide-theme-nordic` | Outfit |
| `stark` | Minimal Stark | `slide-theme-stark` | Space Grotesk |
| `sunset` | Vibrant Sunset | `slide-theme-sunset` | Outfit |
| `brutalist` | Industrial Yellow | `slide-theme-brutalist` | Syne |
| `lime` | Neon Emerald | `slide-theme-lime` | Unbounded |

### App context found in this repo

The app already has a static broadcast theme workflow:

- `src/types/broadcast.ts` defines `BroadcastTheme`
- `src/lib/builtin-themes.ts` defines built-in static themes
- `src/stores/broadcast/theme-slice.ts` stores themes and active theme IDs
- `src/components/broadcast/theme-library.tsx` shows selectable theme thumbnails
- `src/components/broadcast/theme-designer.tsx` opens the 3-panel theme designer
- `src/components/ui/canvas-verse.tsx` renders theme thumbnails/previews through canvas
- `src/lib/verse-renderer.ts` and `src/lib/verse-draw.ts` draw static presentation frames
- `src/hooks/use-broadcast-output-runtime.ts` renders the live output canvas and pushes NDI frames

Important constraint:

The current live output is canvas-based, not DOM/CSS-based. CSS-only moving backgrounds from the HTML cannot be copied directly into the output path if they must also work for NDI. The app needs a canvas-native kinetic renderer that mirrors the HTML movement, plus a separate catalog/workflow for these motion presets.

---

## SECTION 0 - PRIME DIRECTIVE

Implement the smallest complete kinetic-theme workflow that lets SabbathCue use the 14 HTML-inspired moving themes without destabilizing the existing static theme designer.

Do not replace the current theme system. Add kinetic support as an additive path.

Do not add network Google Font dependencies during this plan. Use existing local app fonts as offline-safe approximations unless the operator separately approves exact font package additions.

---

## SECTION 1 - FULL SCOPE DEFINITION

### 1.1 What this plan accomplishes

Create a separate kinetic theme workflow inside the existing broadcast theme system. The workflow will add the 14 HTML-inspired themes as built-in kinetic presets, render their moving backgrounds in canvas for preview and live output, keep the existing static theme designer intact, and ensure active main/alt broadcast outputs can select and persist kinetic themes like existing themes.

### 1.2 Files in scope - every file the agent is allowed to modify

Implementation files:

```text
src/types/broadcast.ts
src/lib/kinetic-themes.ts
src/lib/kinetic-theme-renderer.ts
src/lib/builtin-themes.ts
src/lib/verse-draw.ts
src/lib/verse-renderer.ts
src/lib/broadcast-render-key.ts
src/components/ui/canvas-verse.tsx
src/components/broadcast/theme-library.tsx
src/components/broadcast/properties-panel.tsx
src/hooks/use-broadcast-output-runtime.ts
```

Test files:

```text
src/lib/kinetic-themes.test.ts
src/lib/kinetic-theme-renderer.test.ts
src/lib/broadcast-render-key.test.ts
src/lib/verse-renderer.test.ts
src/components/broadcast/theme-library.test.tsx
src/hooks/use-broadcast-output-runtime.test.ts
tests/e2e/broadcast-output.spec.ts
```

### 1.3 Files explicitly out of scope

```text
package.json
package-lock.json
bun.lock
src-tauri/
web/
video/
supabase/
data/
any external HTML prototype file under C:\Users\fanel\Downloads\
any file not listed in Section 1.2
```

### 1.4 Dependencies and external systems involved

```text
No new npm dependencies.
No network font loading.
Existing Tauri event channel: broadcast:verse-update.
Existing NDI frame push path through use-broadcast-output-runtime.ts.
Existing local persisted theme store: broadcast-themes.json.
```

### 1.5 Definition of done

- The 14 HTML-inspired kinetic presets exist as built-in themes.
- Kinetic themes are visibly separated in the theme library.
- Selecting a kinetic theme updates the active theme and live output.
- Preview thumbnails and live broadcast output animate their backgrounds.
- Static themes continue rendering exactly as before.
- Kinetic themes have deterministic static frame rendering for tests.
- NDI receives updated frames while a kinetic theme is live.
- Existing custom themes remain loadable because new fields are optional.
- Targeted unit tests pass.
- `npm.cmd run test:unit -- <targeted files>` passes for touched tests.
- `npm.cmd run typecheck` passes.
- No file outside Section 1.2 is modified.

---

## SECTION 2 - CHECKPOINT EXECUTION PLAN

### CP-01 - Read and understand the full codebase context

**Status:** `PENDING`

Instructions:

1. Read every file in Section 1.2 that already exists.
2. Search for these symbols before editing:
   - `BroadcastTheme`
   - `drawBackground`
   - `renderPresentation`
   - `getBroadcastRenderKey`
   - `CanvasVerse`
   - `activeThemeId`
   - `setActiveTheme`
   - `broadcast:verse-update`
3. Confirm how theme data flows from theme library selection to live canvas and NDI.
4. Confirm whether current tests mock canvas rendering or assert real draw behavior.

Proof required:

```text
File map with line counts.
Raw rg output for listed symbols.
3-5 bullet data-flow summary.
```

### CP-02 - Generate complete implementation plan, exact code, and tests

**Status:** `PENDING`

#### Phase A - Change index

```text
CHANGE 1
  File:     src/types/broadcast.ts
  Type:     MODIFY
  Summary:  Add optional kinetic theme metadata and optional render time to RenderOptions.
  Depends:  none

CHANGE 2
  File:     src/lib/kinetic-themes.ts
  Type:     ADD
  Summary:  Add the 14 HTML-derived kinetic preset definitions and conversion helpers.
  Depends:  CHANGE 1

CHANGE 3
  File:     src/lib/kinetic-theme-renderer.ts
  Type:     ADD
  Summary:  Draw canvas-native moving mesh, drift, dot-grid, and stripe effects from kinetic metadata.
  Depends:  CHANGE 1, CHANGE 2

CHANGE 4
  File:     src/lib/builtin-themes.ts
  Type:     MODIFY
  Summary:  Append kinetic built-in themes after existing built-ins without changing existing theme IDs.
  Depends:  CHANGE 2

CHANGE 5
  File:     src/lib/verse-draw.ts
  Type:     MODIFY
  Summary:  Delegate kinetic backgrounds to the kinetic renderer before falling back to solid/gradient/image drawing.
  Depends:  CHANGE 3

CHANGE 6
  File:     src/lib/verse-renderer.ts
  Type:     MODIFY
  Summary:  Pass render time through to background drawing.
  Depends:  CHANGE 5

CHANGE 7
  File:     src/lib/broadcast-render-key.ts
  Type:     MODIFY
  Summary:  Include kinetic metadata in render keys while excluding transient time values.
  Depends:  CHANGE 1

CHANGE 8
  File:     src/components/ui/canvas-verse.tsx
  Type:     MODIFY
  Summary:  Animate preview canvases only when the selected theme has kinetic metadata.
  Depends:  CHANGE 6

CHANGE 9
  File:     src/hooks/use-broadcast-output-runtime.ts
  Type:     MODIFY
  Summary:  Run a live render loop for kinetic themes and push NDI frames at configured FPS while active.
  Depends:  CHANGE 6, CHANGE 7

CHANGE 10
  File:     src/components/broadcast/theme-library.tsx
  Type:     MODIFY
  Summary:  Add a kinetic filter/section and badge so motion presets are a separate selection workflow.
  Depends:  CHANGE 4

CHANGE 11
  File:     src/components/broadcast/properties-panel.tsx
  Type:     MODIFY
  Summary:  Show kinetic themes as preset-based themes and avoid presenting unsupported background controls as fully editable motion controls.
  Depends:  CHANGE 1

CHANGE 12
  File:     tests listed in Section 1.2
  Type:     ADD/MODIFY
  Summary:  Cover catalog completeness, renderer determinism, render key behavior, library filtering, and live output animation.
  Depends:  CHANGE 1-11
```

#### Phase B - Required implementation details

Kinetic metadata should be optional:

```ts
type KineticBackgroundKind = "mesh" | "grid" | "stripes"

interface BroadcastKineticTheme {
  source: "html-prototype-v2"
  presetId: string
  group: "classical" | "modern"
  backgroundKind: KineticBackgroundKind
  colors: string[]
  accentColor: string
  motion: {
    durationMs: number
    driftAmount: number
    hueShiftDegrees: number
    saturationBoost: number
  }
  pattern?: "dot-grid" | "diagonal-stripes"
}
```

`BroadcastTheme` should receive:

```ts
kinetic?: BroadcastKineticTheme
```

`RenderOptions` should receive:

```ts
timeMs?: number
```

The kinetic renderer must:

- draw a deterministic frame for `timeMs`
- support `timeMs = 0` for stable tests and static thumbnails
- avoid CSS, DOM measurement, and external image dependencies
- use the existing `BroadcastTheme.background` as fallback if kinetic drawing fails
- draw cyberpunk dot-grid and brutalist stripe overlays
- not animate static themes

The live output runtime must:

- keep current one-shot rendering for static themes
- start a requestAnimationFrame loop only for kinetic themes
- cancel the loop when the payload changes to a static theme, video, or null output
- throttle NDI pushes to the configured NDI FPS
- keep transition behavior working when switching into or out of kinetic themes

The theme library must:

- preserve `all`, `pinned`, and `custom`
- add a `kinetic` filter or separate built-in kinetic section
- show kinetic presets without mixing them visually with custom static themes
- keep selecting a theme as the only required user action

The designer/properties behavior must:

- allow kinetic built-ins to be selected and set active
- avoid pretending unsupported motion internals are editable
- keep "Save Theme" behavior from corrupting the built-in kinetic preset
- if a kinetic built-in is saved as custom, preserve the kinetic metadata unless the implementation deliberately converts it to static and documents that choice in CP-02C

### CP-02C - Risks, trade-offs, and operator sign-off

**Status:** `PENDING`

Risks to document before implementation:

- Canvas rendering will approximate the HTML/CSS motion, not copy browser CSS animations exactly.
- Exact Google font families are not included unless package changes are approved.
- Kinetic NDI output increases CPU/GPU work because frames must be redrawn continuously.
- Fabric designer preview may show a static representative frame unless explicitly animated.
- Persisted custom themes must remain backward-compatible.

Operator sign-off required before CP-03:

```text
APPROVED BY: Fanel / 2026-06-30 (via Claude Code interactive sign-off)
APPROVED SCOPE: exact Section 1.2 file list (additive only)
APPROVED FONT APPROACH: offline-safe approximations (existing local app fonts; no network fonts)
APPROVED DESIGNER BEHAVIOR: animated designer canvas (CanvasVerse animates kinetic by default;
  theme-library thumbnails animate only when selected/hovered to bound CPU)
```

### CP-03 - Apply approved code atomically

**Status:** `PENDING`

Apply one change at a time in the order from CP-02 Phase A.

After each change:

```text
git diff -- <changed file>
npm.cmd run test:unit -- <targeted test file>
```

### CP-04 - Full regression sweep

**Status:** `PENDING`

Required commands:

```powershell
npm.cmd run typecheck
npm.cmd run test:unit -- src/lib/kinetic-themes.test.ts src/lib/kinetic-theme-renderer.test.ts src/lib/broadcast-render-key.test.ts src/lib/verse-renderer.test.ts src/components/broadcast/theme-library.test.tsx src/hooks/use-broadcast-output-runtime.test.ts
```

Run broader checks if touched code affects existing flows:

```powershell
npm.cmd run test:unit
npm.cmd run test:e2e
```

### CP-04.5 - Code quality review

**Status:** `PENDING`

Review dimensions:

- Readability and naming
- Error handling and edge cases
- Security and safety
- Performance and frame-loop efficiency
- Architectural fit with existing broadcast theme system
- Minimalism and anti-bloat

Special anti-bloat checks:

- No new dependency unless exact font approval is recorded.
- No duplicate theme objects outside the kinetic catalog.
- No CSS-only path that bypasses NDI.
- No frame loop running for static themes.
- No changes to existing built-in theme IDs.

### CP-05 - Final review

**Status:** `PENDING`

Proof required:

```text
Final git diff.
List of files changed.
Targeted test output.
Typecheck output.
Known limitations.
```

### CP-06 - Change report

**Status:** `PENDING`

The final report must explain:

- What was added
- Why kinetic themes are separate from static themes
- How the 14 HTML themes map into app presets
- How canvas animation and NDI frame pushing work
- What did not change
- How the implementation was tested

---

## SECTION 3 - ACCEPTANCE TEST MATRIX

| Area | Test |
|---|---|
| Catalog | `KINETIC_THEME_PRESETS` contains exactly 14 presets with the expected IDs. |
| Built-ins | `BUILTIN_THEMES` includes all existing IDs plus 14 kinetic IDs. |
| Renderer | Same theme + same `timeMs` produces the same draw calls. |
| Renderer | Same theme + different `timeMs` changes kinetic background drawing. |
| Renderer | Static themes still use existing background drawing. |
| Render key | Kinetic metadata affects render key; `timeMs` does not. |
| Preview | `CanvasVerse` starts RAF only for kinetic themes and cancels on unmount. |
| Live output | Runtime redraws kinetic themes while active. |
| Live output | Runtime stops kinetic loop for static theme, video item, or null payload. |
| NDI | Kinetic live output pushes frames at configured FPS while active. |
| Theme library | Kinetic filter/section shows the 14 presets. |
| Selection | Selecting a kinetic theme sets `activeThemeId` and emits the broadcast payload. |
| Persistence | Existing custom static themes load with `kinetic` undefined. |

---

## SECTION 4 - HARD STOP RULES

- Do not modify files outside Section 1.2.
- Do not add exact font dependencies unless the operator approves editing package files.
- Do not implement CSS-only motion for the live output path.
- Do not remove or rename existing built-in theme IDs.
- Do not run a continuous animation loop for static themes.
- Do not claim completion without tests and a CP-06 change report.

---

## PLAN COMPLETION SIGN-OFF

| Checkpoint | Status | Proof location |
|---|---|---|
| CP-01 Read codebase | `[x]` | Data-flow summary in execution session |
| CP-02A Change index | `[x]` | CP-02 Phase A |
| CP-02B Code generation | `[x]` | Implemented CHANGE 1-12 |
| CP-02C Risks/sign-off | `[x]` | CP-02C (Fanel, 2026-06-30) |
| CP-03 Apply code | `[x]` | All 11 source files + 5 test files applied |
| CP-04 Regression sweep | `[x]` | typecheck clean; full unit 774 passed / 1 skipped |
| CP-04.5 Quality review | `[x]` | Anti-bloat checks below |
| CP-05 Final review | `[x]` | git diff within Section 1.2 only |
| CP-06 Change report | `[x]` | Reported to operator |

**Quality verdict:** `[ PASS ]`

**Anti-bloat verdict:** `[ PASS ]` — no new deps; no duplicate theme objects (single catalog);
no CSS-only output path (canvas-native renderer feeds NDI); no RAF loop for static themes;
no existing built-in theme IDs changed.

**Human operator final sign-off:** `[ PENDING OPERATOR ]`

**Definition of done verified:** `[ YES ]`

