<!-- markdownlint-disable -->

# Production Sweep Report

> **Living document.** Automated production-readiness sweep of the SabbathCue / Rhema codebase. Update after each full sweep or when gate status changes.

| Field | Value |
|---|---|
| **Last updated** | `2026-06-29 17:12` |
| **Updated by** | Cursor agent — full production sweep (read-only) |
| **Commit / build** | `0941df6` on `main` (+ 10 uncommitted hymn-themes WIP files) |
| **Test environment** | Local — Windows 11, Bun, Vitest 4.1.8, Rust stable, Vite 8 |
| **Overall status** | 🔴 **Not production-ready** — lint and desktop build fail on WIP |
| **Action plan** | [PRODUCTION_ACTION_PLAN.md](PRODUCTION_ACTION_PLAN.md) |

> **Scope note.** This pass ran automated checks only: typecheck, ESLint, Vitest (with coverage), Rust tests, Clippy, Vite build, Next.js web build, jscpd duplication scan, and maintainability guard tests. **Playwright E2E**, **Tauri release build**, and **manual live-service flows** (mic + STT + NDI + 90-min soak) were **not** executed.

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ Pass | Gate green on this build |
| ⚠️ Partial | Core logic passes; integration or manual path not verified |
| ❌ Fail | Gate red — blocks release |
| 🚧 Not run | Not executed on this build |

---

## 1. Executive Summary

The codebase has **strong automated test coverage** on core logic (757 Vitest + ~631 Rust tests, Clippy clean, web site builds). However, **the desktop app cannot ship** on the current working tree because uncommitted hymn-themes work introduces a lint/type error that blocks `bun run build`.

Structural debt is **concentrated** in a handful of oversized modules (Rust detection cluster, `verse-renderer.ts`, broadcast store facade) rather than spread across the repo. Duplication is low (0.72% jscpd). There is no correctness crisis and no rewrite case — work is incremental hardening, WIP completion, and planned decomposition.

| Area | Verdict |
|---|---|
| Automated test net | ✅ Strong |
| Type safety (standalone typecheck) | ✅ Pass |
| Desktop lint + build | ❌ Fail (WIP blocker) |
| Rust quality | ✅ Pass |
| Marketing / docs site | ✅ Pass |
| E2E + manual live paths | 🚧 Not verified |
| Structural maintainability | ⚠️ Several god modules past safe size |

---

## 2. Automated Gate Results

| Gate | Command | Result | Details |
|---|---|---|---|
| Typecheck | `bun run typecheck` | ✅ | 0 errors (~13 s) |
| ESLint (app) | `bun run lint` | ❌ | 1 error — unused import in `QueueWorkspace.tsx` |
| Production build | `bun run build` | ❌ | `TS6133` — same unused import blocks `tsc -b` |
| Unit tests | `bun run test:unit` | ✅ | 757 passed, 1 skipped, 105 files (~38 s) |
| Coverage | `bun run test:coverage` | ✅ | 48.5% stmts / 50.1% lines / 42.7% branches |
| Rust tests | `cargo test --workspace` | ✅ | 631 passed, 1 ignored (~2 min) |
| Rust Clippy | `cargo clippy -D warnings` | ✅ | 0 warnings |
| Web build | `bun run web:build` | ✅ | Next.js 16 static export OK |
| Web lint | `bun run web:lint` | ✅ | 0 errors |
| Duplication | `bun run dup` (jscpd) | ✅ | 0.72% duplicated lines (gate: <3%) |
| Maintainability guard | `maintainability-guard.test.ts` | ✅ | File ceilings, IPC wrapper, no empty catches |
| Playwright E2E | `bun run test:e2e` | 🚧 | Not run |
| Tauri release build | `bun run tauri:build:release` | 🚧 | Not run (blocked by frontend build) |
| Manual live-service | — | 🚧 | Not run |

### Build Blocker

Uncommitted hymn-themes work in `src/components/queue/QueueWorkspace.tsx` imports `useBroadcastStore` but does not use it. `useItemTheme` is used correctly.

```
src/components/queue/QueueWorkspace.tsx:25:10
  error  'useBroadcastStore' is defined but never used  @typescript-eslint/no-unused-vars

src/components/queue/QueueWorkspace.tsx(25,10): error TS6133:
  'useBroadcastStore' is declared but its value is never read.
```

---

## 3. Uncommitted Working Tree

Ten modified files relate to in-progress **hymn-only themes** work (see [docs/superpowers/specs/2026-06-29-hymn-themes-plan.md](docs/superpowers/specs/2026-06-29-hymn-themes-plan.md)):

| File | Area |
|---|---|
| `src/lib/builtin-themes.ts` | 5 new hymn themes + default ID |
| `src/stores/broadcast-store.ts` | `hymnThemeId`, `resolveThemeIdForItem`, `useItemTheme` |
| `src/stores/broadcast/persistence.ts` | Persist `hymnThemeId` |
| `src/stores/broadcast-store.test.ts` | Resolver + sync tests |
| `src/components/broadcast/theme-library.tsx` | "Use for hymns" action, badge, filter |
| `src/components/panels/preview-panel.tsx` | Preview uses `useItemTheme` |
| `src/components/panels/live-output-panel.tsx` | Live mirror uses `useItemTheme` |
| `src/components/queue/QueueWorkspace.tsx` | Thumbnail uses `useItemTheme` (+ unused import) |
| `src/components/panels/preview-panel.test.tsx` | Test updates |
| `src/components/panels/live-output-panel.test.tsx` | Test updates |

Unit tests pass for this WIP; lint and build do not.

---

## 4. Coverage & Quality Metrics

| Metric | Value | Baseline / gate |
|---|---|---|
| Vitest statements | 48.49% | CI floor ~40% |
| Vitest lines | 50.13% | — |
| Vitest branches | 42.69% | — |
| jscpd duplication | 0.72% | Gate <3% |
| Component `.test.tsx` files | 21 | ~117 component `.tsx` files (~18%) |
| Production logic files >1k LOC | 6 | Excludes static data blobs |

### Lowest-covered UI surfaces (0% in coverage report)

These are **test gaps**, not necessarily broken features:

- **Panels:** `egw-browser.tsx`, `hymnal-panel.tsx`, `search-panel.tsx`, `transcript-panel.tsx`, `queue-panel.tsx`
- **Service plan:** most editors except `LiveServicePlanPage.tsx`
- **Settings:** most sections except `BibleSection.tsx`
- **Broadcast designer:** `design-canvas.tsx`, `background-properties.tsx`, `text-properties.tsx`, `BroadcastOutputCard.tsx`

---

## 5. jscpd Duplication Clones (26 total)

Duplication is within acceptable bounds. Notable clusters for future DRY work:

| Cluster | Files |
|---|---|
| Broadcast property panels | `background-properties.tsx` ↔ `text-properties.tsx`, `layout-properties.tsx` ↔ `text-properties.tsx` |
| Designer canvas | `design-canvas.tsx` (internal clones) |
| Theme library | `theme-library.tsx` (duplicate card blocks) |
| Detections panel | `detections-panel.tsx` (self-duplicated handlers) |
| Service plan refs | `HymnRefsEditor.tsx` ↔ `ScriptureRefsEditor.tsx` |
| Settings admin | `AccountSection.tsx` ↔ `AnnouncementsAdminPanel.tsx` |
| Supabase auth | `auth.ts` (internal session/error paths) |
| Service plan lib | `prepare-queue-resources.ts` ↔ `service-plan-live-effects.ts` |
| Controller guard | `controller-ui-guard.ts` (internal) |
| Presentation nav | `presentation-deck-navigation.ts` (internal) |

Full jscpd output available via `bun run dup`.

---

## 6. Feature Status (Automated vs Manual)

Aligned with [FUNCTIONALITY_TEST_REPORT.md](FUNCTIONALITY_TEST_REPORT.md); updated counts reflect this sweep.

| # | Feature | Automated | Manual / E2E |
|---|---|---|---|
| 1 | Live Desk | ⚠️ | No full E2E |
| 2 | STT / transcription | ✅ | Mic hardware not verified this run |
| 3 | Bible verse detection | ✅ | — |
| 4 | Bible lookup & rendering | ✅ | — |
| 5 | EGW writings | ⚠️ | Browser UI untested |
| 6 | Broadcast / live output | ✅ | Designer UI manual |
| 7 | NDI output | ⚠️ | No hardware run |
| 8 | Themes & styling | ⚠️ | Hymn themes WIP breaks build |
| 9 | Presentation queue | ✅ | — |
| 10 | Service plans | ✅ | — |
| 11 | Broadcast Control workspace | ✅ | — |
| 12 | SDA Hymns / voice | ✅ | — |
| 13 | Sermon / custom slides | ✅ | — |
| 14 | Church library | ✅ | — |
| 15 | PowerPoint / PDF import | ⚠️ | No real PPT run |
| 16 | Remote control | ✅ | — |
| 17 | Settings | ✅ | — |
| 18 | Account & verification | ⚠️ | Gate UI untested |
| 19 | Announcements | ✅ | — |
| 20 | App updates | ✅ | — |
| 21 | Tutorial | ⚠️ | Overlay manual |
| 22 | Help & legal | ✅ | — |

---

## 7. Structural Maintainability (God Files)

From [CODE_QUALITY_REPORT.md](CODE_QUALITY_REPORT.md), refreshed line counts on this build:

### Production logic over 1,000 LOC (decompose before growing)

| Lines | Path | Concern |
|---:|---|---|
| 2,365 | `src-tauri/crates/detection/src/direct/detector.rs` | Core direct detection engine |
| 1,256 | `src-tauri/crates/detection/src/reading_mode.rs` | Reading-mode state machine |
| 1,251 | `src-tauri/crates/detection/src/direct/parser.rs` | Reference parsing grammar |
| 1,203 | `src-tauri/src/commands/stt/detection.rs` | Live STT → detection loop + IPC |
| 1,151 | `src/lib/verse-renderer.ts` | Canvas rendering monolith |
| 1,130 | `src-tauri/src/commands/detection.rs` | Detection Tauri command surface |

### Static / data blobs (acceptable; consider asset move when touched)

| Lines | Path |
|---:|---|
| ~52,000 | `src/data/sda-hymnal-chunks/*.ts` + index |
| 1,567 | `src/lib/builtin-themes.ts` (grew with hymn themes WIP) |
| 1,130 | `src-tauri/crates/detection/src/semantic/synonyms.rs` |

### Near-threshold (501–900 LOC)

| Lines | Path |
|---:|---|
| 828 | `src/components/verification/VerificationScreen.tsx` |
| 700 | `src-tauri/crates/stt/src/deepgram.rs` |
| 665 | `src/hooks/use-broadcast-output-settings.ts` |
| 673 | `src-tauri/src/commands/stt/mod.rs` |
| 648 | `src/components/ui/sidebar.tsx` (shadcn primitive) |
| 688 | `src-tauri/src/commands/secrets.rs` |
| 679 | `src-tauri/crates/detection/src/pipeline.rs` |
| 639 | `src-tauri/crates/detection/src/merger.rs` |
| 569 | `src-tauri/crates/api/src/http.rs` |
| 537 | `src/hooks/use-broadcast-output-runtime.ts` |
| 513 | `src/components/broadcast/design-canvas.tsx` |
| 507 | `src/components/panels/hymnal-panel.tsx` |
| 496 | `src/hooks/use-broadcast-output-runtime.ts` |
| 476 | `src/components/settings/sections/SpeechSection.tsx` |
| 451 | `src/components/panels/live-output-panel.tsx` |
| 421 | `src/components/settings/sections/AccountSection.tsx` |
| 395 | `src/components/broadcast/theme-library.tsx` |
| 381 | `src/stores/broadcast-store.ts` (facade over extracted slices) |

---

## 8. What Passed (Preserve These Patterns)

| Pattern | Evidence |
|---|---|
| Layered frontend | hooks → stores → lib/services → components |
| Domain Rust crates | 6 crates with clear boundaries |
| Workflow libs outside React | `verse-detection-workflow.ts`, `presentation-workflow.ts` |
| Dual entry points | `main.tsx` vs `broadcast-output.tsx` |
| Colocated tests | `*.test.ts` beside hot modules |
| IPC guard | `@tauri-apps/api/core` only imported from `tauri-runtime.ts` |
| Server-side auth | Supabase RPCs + RLS |
| Low duplication | 0.72% jscpd |
| Maintainability guard | File ceilings enforced for reviewed shells |

---

## 9. What This Sweep Did Not Cover

- Playwright E2E (`bun run test:e2e`)
- Tauri release installer build (`bun run tauri:build:release`)
- Live mic + STT + NDI hardware verification
- 90-minute soak / memory profiling
- Supabase RLS table-by-table verification (SEC-001)
- `cargo deny` advisory scan (green in prior CI; not re-run here)
- Public Bible DB / embedding asset verification scripts

---

## 10. Related Documents

| Document | Purpose |
|---|---|
| [PRODUCTION_ACTION_PLAN.md](PRODUCTION_ACTION_PLAN.md) | Prioritized work to sort out all open items |
| [FUNCTIONALITY_TEST_REPORT.md](FUNCTIONALITY_TEST_REPORT.md) | Per-feature functional status |
| [CODE_QUALITY_REPORT.md](CODE_QUALITY_REPORT.md) | Structural maintainability audit |
| [CODE_REFACTORING_PLAN.md](CODE_REFACTORING_PLAN.md) | Refactoring backlog (R1–R19) |
| [docs/superpowers/specs/2026-06-29-hymn-themes-plan.md](docs/superpowers/specs/2026-06-29-hymn-themes-plan.md) | In-progress hymn themes feature |
| [docs/superpowers/specs/2026-06-29-code-review-fixes-plan.md](docs/superpowers/specs/2026-06-29-code-review-fixes-plan.md) | Code review remediation (CP-01–06 done) |

---

## Appendix — Sweep Commands

```powershell
# From repo root (PowerShell)
bun run typecheck
bun run lint
bun run test:unit
bun run test:coverage
bun run build
bun run dup
bun run web:build
bun run web:lint

# Rust (from src-tauri/)
cargo test --workspace
cargo clippy --all-targets --all-features --locked -- -D warnings
```
