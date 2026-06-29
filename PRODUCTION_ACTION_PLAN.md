# Production Action Plan

<!-- markdownlint-disable MD060 MD022 MD032 -->

> **Action plan** derived from [PRODUCTION_SWEEP_REPORT.md](PRODUCTION_SWEEP_REPORT.md) (2026-06-29). Tracks everything that must be sorted out before calling the desktop app production-ready, plus structural refactors that should not wait indefinitely.
>
> Legend: `[ ]` todo · `[~]` in progress · `[x]` done · 🔴 blocker · 🟡 should fix · 🟢 optional / when touched

| Field | Value |
|---|---|
| **Created** | `2026-06-29` |
| **Source sweep** | [PRODUCTION_SWEEP_REPORT.md](PRODUCTION_SWEEP_REPORT.md) |
| **Baseline commit** | `0941df6` (+ hymn-themes WIP) |
| **Target** | Green lint + build + full regression; then structural debt in priority order |

---

## 0. How to Use This Plan

1. Work **top to bottom** within each phase — later phases assume earlier gates are green.
2. Keep PRs **small and behavior-preserving** unless the row explicitly says "feature".
3. Re-run the sweep commands in [PRODUCTION_SWEEP_REPORT.md § Appendix](PRODUCTION_SWEEP_REPORT.md#appendix--sweep-commands) after each phase.
4. Cross-reference [CODE_REFACTORING_PLAN.md](CODE_REFACTORING_PLAN.md) for detailed technique notes (R1–R19).

---

## Phase 1 — Release Blockers (do first)

These items prevent shipping **today**. Estimated total: **<1 hour** for PA-001; PA-002 depends on hymn-themes plan completion.

| ID | Priority | Item | Files | Acceptance criteria | Status |
|---|---|---|---|---|---|
| **PA-001** | 🔴 | Remove unused `useBroadcastStore` import (or wire it if still needed) | `src/components/queue/QueueWorkspace.tsx` | `bun run lint` and `bun run build` pass | `[ ]` |
| **PA-002** | 🔴 | **Finish hymn-themes WIP** per spec | See [hymn-themes plan](docs/superpowers/specs/2026-06-29-hymn-themes-plan.md) §1.2 | All CP checkpoints done; resolver tests green; lint + build green; manual: hymn live uses hymn theme, scripture keeps active theme | `[~]` |
| **PA-003** | 🔴 | Commit or revert WIP — do not leave main-like tree in broken build state | All 10 modified files | Working tree clean or on feature branch with green gates | `[ ]` |

### PA-002 checklist (from hymn-themes plan definition of done)

- [ ] 5 builtin hymn themes in `src/lib/builtin-themes.ts`
- [ ] `hymnThemeId` state + `resolveThemeIdForItem` + `useItemTheme` in broadcast store
- [ ] Persistence in `src/stores/broadcast/persistence.ts`
- [ ] Theme library "Use for hymns" UI + badge + filter tab
- [ ] Preview, live-output, and queue thumbnails use `useItemTheme(item)`
- [ ] `broadcast-store.test.ts` covers resolver + hymn sync for both outputs
- [ ] No unused imports; lint + build green

---

## Phase 2 — Verification Gaps (before calling it "production")

Automated logic is strong; these gaps are why [FUNCTIONALITY_TEST_REPORT.md](FUNCTIONALITY_TEST_REPORT.md) marks several features ⚠️ Partial.

| ID | Priority | Item | How | Acceptance criteria | Status |
|---|---|---|---|---|---|
| **PA-010** | 🟡 | Run Playwright E2E locally | `bun run test:e2e` | Spec passes or failures logged as new issues | `[ ]` |
| **PA-011** | 🟡 | Gate E2E in CI (if not already) | `.github/workflows/desktop-ci.yml` | E2E runs on PR / main | `[ ]` |
| **PA-012** | 🟡 | Manual live-service smoke test | Operator console: go live, queue advance, detection → slide, hymn voice command | Checklist signed off in FUNCTIONALITY_TEST_REPORT | `[ ]` |
| **PA-013** | 🟡 | NDI hardware smoke test | Broadcast to NDI receiver on LAN | At least one successful frame on physical NDI monitor | `[ ]` |
| **PA-014** | 🟢 | 90-minute soak test | Live desk running with STT + detection | No memory leak / FPS collapse (R10 profiling) | `[ ]` |
| **PA-015** | 🟡 | Tauri release build | `bun run tauri:build:release` | Installer artifact builds after Phase 1 green | `[ ]` |
| **PA-016** | 🟡 | Update FUNCTIONALITY_TEST_REPORT | After Phase 1–2 | Counts, commit hash, gate table match reality | `[ ]` |

### Manual smoke checklist (PA-012)

- [ ] Start app, select audio device, transcription finals appear
- [ ] Speak "John 3 16" → detection card → preview → go live
- [ ] Queue: add hymn, advance, emergency slide
- [ ] Service plan: run service mode advances items
- [ ] Settings persist across restart
- [ ] Remote control: at least one HTTP/OSC action

---

## Phase 3 — Structural Refactors (need sorting, not optional forever)

These are **required for long-term maintainability** per [CODE_QUALITY_REPORT.md](CODE_QUALITY_REPORT.md). Do not add features to these files without completing the relevant row first.

### 3A — Quick wins (small effort, high duplication payoff)

| ID | Ref plan | Item | Files | Status |
|---|---|---|---|---|
| **PA-020** | R15 | Extract shared `callRpc<T>()` in `src/lib/supabase/rpc.ts`; thin wrappers in account/announcements/auth/devices | `src/lib/supabase/*.ts` | `[ ]` |
| **PA-021** | R16 | Generic `useApiKeySettings({ setCommand, hasCommand, clearCommand, label })` | `use-deepgram-key-settings.ts`, `use-gladia-key-settings.ts` | `[ ]` |
| **PA-022** | CQ-009 | `Promise.all` for independent keychain probes on settings hydrate | `src/stores/settings-store.ts` | `[ ]` |
| **PA-023** | CQ-007 | `withBibleInvoke` helper for repeated invoke boilerplate | `src/hooks/use-bible.ts` | `[ ]` |
| **PA-024** | CQ-010 | Remove thin `getPresentationReference` wrapper chain | `src/types/presentation.ts`, `src/types/queue.ts` | `[ ]` |

### 3B — Broadcast store decomposition (medium effort)

| ID | Ref plan | Item | Files | Rule | Status |
|---|---|---|---|---|---|
| **PA-030** | R13 | Extract **theme-library slice** — CRUD, pin, active IDs, hymn theme ID, persistence | `src/stores/broadcast/theme-slice.ts` (new), migrate call sites | Do not grow `broadcast-store.ts` facade | `[~]` partial — slices exist; theme/live still in facade |
| **PA-031** | R13 | Extract **broadcast-live slice** — preview/live items, transitions, opacity | `src/stores/broadcast/live-slice.ts` (new) | ~55 importers to migrate gradually | `[ ]` |
| **PA-032** | R13 | Replace `setNestedValue` on `Record<string, unknown>` in designer with typed paths | `src/stores/broadcast/designer-slice.ts` | Reduces cast chains on hottest theme path | `[ ]` |
| **PA-033** | — | Migrate call sites from `useBroadcastStore` to narrower store hooks | ~55 files | Facade removed or stays thin re-export only | `[ ]` |

### 3C — Detection cluster (large effort, highest Rust regression risk)

| ID | Ref plan | Item | Target modules | Status |
|---|---|---|---|---|
| **PA-040** | R14 | Peel **live session orchestration** from `stt/detection.rs` | `stt/detection/live_session.rs` (new) | `[ ]` |
| **PA-041** | R14 | Keep `stt/detection.rs` as transcript windowing + delegation only | `stt/detection.rs` → <800 LOC | `[ ]` |
| **PA-042** | R14 | Thin `commands/detection.rs` to invoke adapters only | `src-tauri/src/commands/detection.rs` | `[ ]` |
| **PA-043** | CQ-001 | Live path delegates to `pipeline.rs` + `merger.rs` instead of re-orchestrating inline | `stt/detection.rs`, `pipeline.rs`, `merger.rs` | `[ ]` |
| **PA-044** | — | **Do not add features** to `detector.rs`, `parser.rs`, `reading_mode.rs` until split plan approved | — | 🔴 Active rule |

Suggested split order: PA-040 → PA-043 → PA-041 → PA-042. `detector.rs` / `parser.rs` / `reading_mode.rs` splits are separate epics — schedule after live-session peel.

### 3D — Verse renderer (medium effort, designer hot path)

| ID | Ref plan | Item | Extract targets | Status |
|---|---|---|---|---|
| **PA-050** | R4 | Extract text layout / wrap math from `verse-renderer.ts` | `verse-layout.ts` | `[ ]` |
| **PA-051** | R4 | Extract draw routines by presentation kind | `verse-draw-*.ts` | `[ ]` |
| **PA-052** | R4 | Keep public `renderVerseToCanvas` API stable; tests green throughout | `verse-renderer.test.ts` | `[ ]` |

### 3E — Layer decoupling

| ID | Ref plan | Item | Files | Status |
|---|---|---|---|---|
| **PA-060** | R17 | Pure `resolveDetectionVerse` returns `ResolvedVerse \| FallbackReason`; caller reports issues | `src/lib/verse-detection-workflow.ts` | `[ ]` |
| **PA-061** | R18 | Isolate `?demo` / `?e2e` / harness to entry boundary (`bootstrap({ mode })`) | `main.tsx`, `use-tauri-event.ts`, `workflow-trace.ts`, `operator-flow-harness.ts` | `[ ]` |

### 3F — UI duplication (when touching broadcast designer or service plan)

| ID | Item | Files | Status |
|---|---|---|---|
| **PA-070** | Shared property-panel primitives for broadcast designer | `background-properties.tsx`, `text-properties.tsx`, `layout-properties.tsx` | `[ ]` |
| **PA-071** | Shared refs list editor | `HymnRefsEditor.tsx`, `ScriptureRefsEditor.tsx` | `[ ]` |
| **PA-072** | Deduplicate detections-panel handler blocks | `detections-panel.tsx` | `[ ]` |
| **PA-073** | Deduplicate theme-library card blocks | `theme-library.tsx` | `[ ]` |
| **PA-074** | Consolidate service-plan resource prep | `prepare-queue-resources.ts`, `service-plan-live-effects.ts` | `[ ]` |

---

## Phase 4 — Test Coverage Expansion (should sort out for confidence)

Not release blockers, but listed because the sweep found large untested UI surfaces.

| ID | Priority | Target | Suggested approach | Status |
|---|---|---|---|---|
| **PA-080** | 🟡 | Service plan editors (~6% coverage) | Extract pure helpers; add unit tests per editor | `[ ]` |
| **PA-081** | 🟡 | Settings sections (~7% coverage) | Component tests for SpeechSection, AccountSection, RemoteControlSection | `[ ]` |
| **PA-082** | 🟡 | Core panels at 0% | Smoke tests: hymnal-panel, search-panel, transcript-panel, egw-browser | `[ ]` |
| **PA-083** | 🟡 | Broadcast designer | design-canvas interaction tests with mocked fabric | `[ ]` |
| **PA-084** | 🟢 | Raise coverage floor in CI | Consider 50% stmts gate after PA-080–082 | `[ ]` |

---

## Phase 5 — Asset & Bundle Hygiene (optional / when touched)

| ID | Ref plan | Item | Files | Status |
|---|---|---|---|---|
| **PA-090** | R5 | Move builtin themes to JSON asset | `src/lib/builtin-themes.ts` | `[ ]` |
| **PA-091** | R19 | Lazy-load hymnal chunks (JSON or SQLite) | `src/data/sda-hymnal-*` | `[ ]` |
| **PA-092** | R2 | Confirm fabric/canvas/pdf.worker are lazy-loaded | design-canvas, theme-designer, ppt-import | `[ ]` |
| **PA-093** | R3 | Verify Tailwind prunes unused CSS | tailwind/vite config | `[ ]` |
| **PA-094** | R6 | Leveled logger replacing stray `console.*` | `src/**` (~67 sites) | `[ ]` |

---

## Phase 6 — Security & Ops Verification (from prior audits)

| ID | Source | Item | Status |
|---|---|---|---|
| **PA-100** | SEC-001 | Verify RLS enabled + policies on every Supabase table | `[ ]` |
| **PA-101** | SEC-003 | Asset path containment after `canonicalize()` | `src-tauri/src/commands/assets.rs` (R11) | `[ ]` |
| **PA-102** | SEC-004 | Confirm verification token storage + logout invalidation | `session-storage.ts` (R12) | `[ ]` |
| **PA-103** | R8 | Keep `cargo deny` green in CI | Already done — verify on each Rust dep bump | `[x]` |

Code review fixes from [2026-06-29-code-review-fixes-plan.md](docs/superpowers/specs/2026-06-29-code-review-fixes-plan.md) are marked **DONE** (CP-01–06). No open items from that plan unless regression found.

---

## Recommended Execution Order

```
Phase 1  PA-001 → PA-002 → PA-003          (unblock build + finish feature)
Phase 2  PA-015 → PA-010 → PA-011 → PA-012 → PA-013 → PA-016
Phase 3  PA-020 → PA-021 → PA-030 → PA-060 → PA-040… → PA-050…
Phase 4  PA-080 → PA-081 → PA-082            (parallel with Phase 3 if different owners)
Phase 5  PA-090+                             (defer until touching those areas)
Phase 6  PA-100 → PA-101 → PA-102           (security verify pass)
```

**If you only have one day:** Phase 1 entirely, then PA-015 + PA-010 + PA-016.

**If you have one week:** Phase 1 + Phase 2 + PA-020 + PA-021 + PA-030 start.

---

## Definition of Done (whole plan)

- [ ] All Phase 1 items `[x]` — lint, build, tests green on `main`
- [ ] Phase 2 manual + E2E checklist completed or explicitly deferred with rationale
- [ ] No production logic file grows past 1k LOC without an approved split plan (PA-044 enforced)
- [ ] R13 + R14 at least **partially complete** with measurable LOC reduction
- [ ] FUNCTIONALITY_TEST_REPORT and PRODUCTION_SWEEP_REPORT updated to match
- [ ] PRODUCTION_ACTION_PLAN items marked `[x]` or moved to deferred with date + reason

---

## Tracking Template (copy per PR)

```markdown
### PR: [title]
- **Closes:** PA-0xx
- **Risk:** low / medium / high
- **Tests run:** test:unit, build, lint, cargo test, [others]
- **Behavior change:** none / feature / fix
- **Follow-ups:** PA-0yy
```

---

## Related Documents

| Document | Role |
|---|---|
| [PRODUCTION_SWEEP_REPORT.md](PRODUCTION_SWEEP_REPORT.md) | Findings that produced this plan |
| [CODE_QUALITY_REPORT.md](CODE_QUALITY_REPORT.md) | CQ-001–010 structural findings |
| [CODE_REFACTORING_PLAN.md](CODE_REFACTORING_PLAN.md) | R1–R19 technique backlog |
| [FUNCTIONALITY_TEST_REPORT.md](FUNCTIONALITY_TEST_REPORT.md) | Per-feature status dashboard |
