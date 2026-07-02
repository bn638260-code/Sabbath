# Code Quality Report (Thermo-Nuclear Review)

> **Living document.** Structural maintainability audit of the whole codebase — god modules, duplication, boundary leaks, and decomposition priorities. Update after major refactors or when new files cross the 1k-line threshold.
>
> Methodology: thermo-nuclear code quality review (ambitious structural simplification, 1k-line rule, spaghetti-growth detection).

| Field                | Value                                                          |
| -------------------- | -------------------------------------------------------------- |
| **Last updated**     | `2026-06-24`                                                   |
| **Updated by**       | Cursor agent — whole-codebase thermo-nuclear review            |
| **Commit / build**   | Audit baseline `9db05ab` (`main`); updated through `c61347c` (`refactor/code-quality-safe-fixes`) |
| **Scope**            | `src/` (~99k LOC), `src-tauri/` (~25k LOC), `web/` (~2.3k LOC) |
| **Overall status**   | 🟡 Mixed but improving — sound layering, several god modules past safe size |
| **Open god files**   | `6` production logic files > 1k LOC (excludes static data and table blobs) |

Related plans: [CODE_REFACTORING_PLAN.md](CODE_REFACTORING_PLAN.md) · [PERFORMANCE_TEST_REPORT.md](PERFORMANCE_TEST_REPORT.md) · [DEBUGGING_REPORT.md](DEBUGGING_REPORT.md) · [SECURITY_TEST_REPORT.md](SECURITY_TEST_REPORT.md)

---

## Status Legend

| Symbol | Meaning                                      |
| ------ | -------------------------------------------- |
| 🔴     | High structural risk — decompose before grow |
| 🟡     | Moderate debt — plan decomposition           |
| 🟢     | Healthy or acceptable (e.g. static data)     |
| ✅     | Pattern worth preserving                     |

---

## 1. Executive Summary

**Verdict:** The codebase has **correct architectural direction** — layered frontend (hooks → stores → lib → components), domain Rust crates, workflow libs outside React, dual entry points for operator vs broadcast output, heavy colocated tests, and Supabase enforcement server-side. There is **no rewrite case**.

The main quality problem is **concentration**: a handful of modules absorb too many concerns and are referenced everywhere. Incremental feature work on these files is now **spaghetti growth** by default.

| Cluster              | Severity | Headline issue                                              |
| -------------------- | -------- | ----------------------------------------------------------- |
| Rust detection / STT | 🔴       | Distributed monolith improved but still has 5+ files > 1k LOC |
| Broadcast store      | 🟡       | Store split is underway; 318 LOC facade still has broad imports |
| Supabase client lib  | 🟡       | Four near-identical RPC modules                             |
| Settings / API keys  | 🟡       | Duplicated Deepgram/Gladia hooks                            |
| Hymnal static data   | 🟢       | ~52k LOC in TS — metric/bundle noise, not logic debt        |
| Boot / test paths    | 🟡       | E2E/demo branches in shared runtime hooks                   |

**Thermo-nuclear approval bar (whole codebase):** Would **not pass** without finishing the detection + broadcast decomposition plan and consolidating obvious duplication (Supabase RPC, API key hooks). Does **not** mean rewrite — means **stop growing central modules** and prefer deletion over rearrangement.

---

## 2. Repository Scale

| Tree          | Files (ts/tsx/rs) | Lines (approx.) |
| ------------- | ----------------- | --------------- |
| `src/`        | 366               | ~99,277         |
| `src-tauri/`  | 93                | ~25,181         |
| `web/`        | ~51               | ~2,328          |
| `data/`       | 17                | ~2,480          |

**Note:** ~52,000 lines in `src/data/sda-hymnal-*` are embedded hymn lyrics (~52% of `src/` line count). Exclude when judging logic complexity.

---

## 3. Architecture (What Works)

### 3.1 Frontend layering

```
Tauri IPC (invoke + events)
        ↓
   hooks/          ← event bridges, side effects
        ↓
 stores/ (Zustand) ← app state, persistence
        ↓
 lib/ + services/  ← pure / domain logic
        ↓
 components/       ← UI panels and workspaces
```

### 3.2 Backend layering

```
lib.rs (bootstrap, managed state, invoke table)
  └── commands/* (21 domain modules)
         └── crates: rhema-audio, rhema-stt, rhema-bible,
                      rhema-detection, rhema-broadcast, rhema-api
```

### 3.3 Patterns to preserve

| Pattern | Location | Why |
| ------- | -------- | --- |
| Workflow libs | `verse-detection-workflow.ts`, `presentation-workflow.ts` | Orchestration outside React |
| Dual entry | `main.tsx` vs `broadcast-output.tsx` | Operator vs projector/NDI isolation |
| Colocated tests | `*.test.ts` beside hot modules | Enables safe decomposition |
| Server-side auth | `supabase/migrations/**`, RPCs + RLS | Correct security boundary |
| Event-driven IPC | Tauri events for STT, detection, broadcast | Decouples Rust from UI timing |

---

## 4. Files Over 1,000 Lines

### 4.1 Production logic (🔴 review / decompose)

| Lines | Path | Concern |
| ----: | ---- | ------- |
| 2,073 | `src-tauri/crates/detection/src/direct/detector.rs` | Core direct detection engine |
| 1,256 | `src-tauri/crates/detection/src/reading_mode.rs` | Reading-mode state machine |
| 1,154 | `src-tauri/src/commands/stt/detection.rs` | Live STT → detection loop + IPC |
| 1,126 | `src/lib/verse-renderer.ts` | Canvas rendering monolith |
| 1,103 | `src-tauri/crates/detection/src/direct/parser.rs` | Reference parsing grammar |
| 1,037 | `src-tauri/src/commands/detection.rs` | Detection Tauri command surface |

### 4.2 Static / data blobs (🟢 acceptable, consider asset move)

| Lines | Path | Note |
| ----: | ---- | ---- |
| 7,308–6,269 | `src/data/sda-hymnal-chunks/*.ts` (7 files) | Embedded hymn lyrics |
| 4,870 | `src/data/sda-hymnal-index.ts` | Hymn index |
| 1,422 | `src/lib/builtin-themes.ts` | Built-in theme JSON |
| 1,130 | `src-tauri/crates/detection/src/semantic/synonyms.rs` | Synonym table |

### 4.3 Near-threshold (501–1000 LOC)

| Lines | Path |
| ----: | ---- |
| 828 | `src/components/verification/VerificationScreen.tsx` |
| 700 | `src-tauri/crates/stt/src/deepgram.rs` |
| 665 | `src/hooks/use-broadcast-output-settings.ts` |
| 655 | `src-tauri/src/commands/stt/mod.rs` |
| 648 | `src/components/ui/sidebar.tsx` (shadcn primitive) |
| 631 | `src-tauri/src/commands/secrets.rs` |
| 584 | `src-tauri/crates/detection/src/pipeline.rs` |
| 554 | `src-tauri/crates/detection/src/merger.rs` |
| 540 | `src-tauri/crates/api/src/http.rs` |
| 537 | `src/hooks/use-broadcast-output-runtime.ts` |

### 4.4 Recently reduced below threshold

| Lines | Path | Current shape |
| ----: | ---- | ------------- |
| 318 | `src/stores/broadcast-store.ts` | Facade with theme/live actions; output issues, designer, monitors, video, and persistence are now under `src/stores/broadcast/**` |

---

## 5. Critical Findings

### CQ-001 — Detection cluster is a distributed monolith 🔴

**Files:** `stt/detection.rs`, `detector.rs`, `reading_mode.rs`, `parser.rs`, `commands/detection.rs`, `pipeline.rs`, `merger.rs`

**Current state:** `detection_logic.rs` now owns pure detection helpers and `detection_jobs.rs` owns semantic job scheduling. `stt/detection.rs` is reduced to ~1,154 LOC but still couples streaming transcript handling, pause flags, semantic windows, reading handoff, merger integration, and event emission.

**Code-judo target:** Split by lifecycle, not line count:

- `stt/detection.rs` → transcript windowing + live-session orchestration only
- `detection/live_session.rs` → per-session state (pause, cooldown, reading handoff)
- `commands/detection.rs` → thin invoke adapters
- Live path **delegates** to existing `pipeline.rs` + `merger.rs` instead of re-orchestrating inline

**Maps to:** CODE_REFACTORING_PLAN R14 (partial)

---

### CQ-002 — Broadcast store facade still too central 🟡

**Files:** `src/stores/broadcast-store.ts` (318 LOC), `src/stores/broadcast/**`, **55** `useBroadcastStore` importers

**Current state:** output issues, designer draft, monitor/projector control, video transport, and persistence have been extracted into slices. The remaining facade still owns theme CRUD, active theme IDs, preview/live items, transitions, opacity, and broadcast sync.

**Remaining type smell:** Designer updates still use `setNestedValue` on `Record<string, unknown>` with cast chains — untyped dot-path mutation on the hottest theme-editing path.

**Next code-judo target:** Finish the split by mutation authority:

| Slice | Owns |
| ----- | ---- |
| `theme-library-store` | CRUD, pin, active theme IDs, persistence |
| `broadcast-live-store` | preview/live items, transitions, opacity |
| `broadcast-output-store` | monitors, fullscreen, output issues |
| `video-transport-store` | loop/mute/volume/commands |

`broadcast-store` stays a thin compatibility facade or is removed after call sites move to narrower stores.

**Maps to:** CODE_REFACTORING_PLAN R13 (partial)

---

### CQ-003 — Supabase RPC duplication 🟡

**Files:** `src/lib/supabase/account.ts`, `announcements.ts`, `auth.ts`, `devices.ts`

**Problem:** Each repeats `getSupabaseClient()` → `rpc()` → `failureMessage` → generic catch. `failureMessage` duplicated; `isNetworkError` duplicated between `auth.ts` and `devices.ts`. `devices.ts` parses RPC responses with manual `unknown` walks.

**Fix:** Single `src/lib/supabase/rpc.ts` with `callRpc<T>(name, args?, fallbackMsg)`; thin per-RPC wrappers remain typed.

**Maps to:** CODE_REFACTORING_PLAN R15 (new)

---

### CQ-004 — API key settings hooks duplicated 🟡

**Files:** `src/hooks/use-deepgram-key-settings.ts`, `use-gladia-key-settings.ts`

**Problem:** Identical UI state, save/clear flow, `SAVED_KEY_DISPLAY`, invoke pattern. Gladia already imports helpers from Deepgram file.

**Fix:** Generic `useApiKeySettings({ setCommand, hasCommand, clearCommand, label })`.

**Maps to:** CODE_REFACTORING_PLAN R16 (new)

---

### CQ-005 — `resolveDetectionVerse` couples layers 🟡

**File:** `src/lib/verse-detection-workflow.ts`

**Problem:** Critical live path embeds `reportOutputIssue` inside catch/fallback branches. Four exit strategies (fetch → chapter cache → detection text → unresolved) in one function. Hard to test without mocking broadcast store.

**Fix:** Pure resolver returns `ResolvedVerse | FallbackReason`; single `reportVerseResolutionIssue(reason)` at caller. Fallback order as explicit strategy list.

**Maps to:** CODE_REFACTORING_PLAN R17 (new)

---

### CQ-006 — Boot path mixes prod, demo, and e2e 🟡

**Files:** `src/main.tsx`, `src/lib/workflow-trace.ts`, `src/hooks/use-tauri-event.ts`, `src/hooks/use-broadcast-output-runtime.ts`, `src/test/operator-flow-harness.ts`

**Problem:** `?demo`, `?e2e`, harness install, and transcription reset share production startup. Test instrumentation branches in hot hooks via URL params and `window` globals.

**Fix:** Entry-point isolation (`main.e2e.tsx`) or single `bootstrap({ mode })` injected at the edge.

**Maps to:** CODE_REFACTORING_PLAN R18 (new)

---

### CQ-007 — `use-bible.ts` invoke boilerplate 🟡

**File:** `src/hooks/use-bible.ts`

**Problem:** Seven functions repeat `if (!isTauriRuntime())` → `invokeTauri` → store setter.

**Fix:** Shared `withBibleInvoke` helper.

---

### CQ-008 — Hymnal data in TypeScript 🟢

**Files:** `src/data/sda-hymnal-chunks/*.ts`, `sda-hymnal-index.ts`

**Problem:** ~52k LOC inflate metrics and bundle; not spaghetti logic.

**Fix:** Lazy JSON or SQLite asset (same pattern as Bible DB).

**Maps to:** CODE_REFACTORING_PLAN R19 (new)

---

### CQ-009 — Sequential independent awaits (trivial) 🟢

**File:** `src/stores/settings-store.ts` (hydrate)

**Problem:** `has_deepgram_api_key` and `has_gladia_api_key` probed sequentially.

**Fix:** `Promise.all` on independent keychain probes.

---

### CQ-010 — Thin wrapper chain 🟢

**Files:** `src/types/presentation.ts`, `src/types/queue.ts`

**Problem:** `getPresentationReference` → `getReferenceFromItem` two-hop for `item.reference`.

**Fix:** Delete chain; use field directly or one canonical helper.

---

## 6. God Files & Orchestrators

### Tier 1 — Critical orchestrators

| File | Lines | Role |
| ---- | ----: | ---- |
| `detector.rs` | 2,073 | Direct verse detection engine |
| `reading_mode.rs` | 1,256 | Reading-mode state machine |
| `stt/detection.rs` | 1,154 | Live detection loop tied to STT |
| `verse-renderer.ts` | 1,126 | Canvas rendering for all presentation types |
| `parser.rs` | 1,103 | Reference parsing grammar |
| `commands/detection.rs` | 1,037 | All detection Tauri commands |

### Tier 2 — Heavy coordinators

| File | Lines | Role |
| ---- | ----: | ---- |
| `use-broadcast-output-settings.ts` | 665 | Broadcast windows, NDI, monitors |
| `stt/mod.rs` | 655 | STT lifecycle + provider routing |
| `use-broadcast-output-runtime.ts` | 537 | NDI frame pump, canvas capture |
| `verse-detection-workflow.ts` | 349 | Detection → bible → queue → broadcast |
| `broadcast-store.ts` | 318 | Theme/live facade over extracted broadcast slices |
| `use-transcription.ts` | 268 | STT event hub |
| `use-remote-control.ts` | 209 | Remote control actions |
| `pipeline.rs` | 584 | Multi-strategy detection orchestration |
| `merger.rs` | 554 | Ensemble merging + cooldown |

---

## 7. Prioritized Refactor Roadmap

| Priority | Target | Effort | Impact | Ref plan ID |
| -------- | ------ | ------ | ------ | ----------- |
| **P0** | Finish `broadcast-store` split (live / themes facade) | Medium | Unblocks 55 dependents | R13 |
| **P0** | Extract `supabase/rpc.ts` shared layer | Small | Deletes duplication, tightens types | R15 |
| **P1** | Peel `stt/detection.rs` live loop from STT commands | Large | Reduces detection regression risk | R14 |
| **P1** | Generic `useApiKeySettings` hook | Small | Immediate duplication win | R16 |
| **P2** | Pure `resolveDetectionVerse` + decouple broadcast issues | Small | Cleaner live path | R17 |
| **P2** | Hymnal data → lazy JSON/SQLite | Medium | Bundle + metric hygiene | R19 |
| **P3** | Split `verse-renderer.ts` by concern | Medium | Designer maintainability | R4 |
| **P3** | E2e harness at entry boundary only | Small | Less branch noise in hot hooks | R18 |
| **P3** | `Promise.all` keychain probes on hydrate | Trivial | Faster boot | — |
| **P3** | `withBibleInvoke` helper | Small | Less invoke boilerplate | — |

**Recommended next slice:** R15 + R16 + finish the live/theme peel from R13 only when a broadcast feature needs that surface.

---

## 8. 1k-Line Rule Tracker

| Rule | Status |
| ---- | ------ |
| Do not add features to `broadcast-store.ts` without keeping the facade thin | 🟡 Active |
| Do not add features to `stt/detection.rs` without splitting first | 🔴 Active |
| Static data blobs may exceed 1k but should move to assets when touched | 🟡 |
| New production logic files should stay under 500 LOC where possible | 🟡 Target |

---

## 9. Metrics Baseline (2026-06-24)

| Metric | Value |
| ------ | ----- |
| Production logic files > 1k LOC | 6 (excl. hymnal/themes/synonyms data) |
| `broadcast-store.ts` importers | 55 files |
| Explicit `: any` in production TS | Rare (mostly tests + hymn chunks) |
| Primary type smell | `unknown` + manual casts at RPC/theme boundaries |
| Supabase RPC modules with duplicate templates | 4 |
| Duplicated API key hook pair | Deepgram + Gladia |
| Unit tests (2026-06-24 branch validation) | 697 tests / ~24 s |

---

## 10. Highest-Conviction Review Comments

If reviewing a PR that touches these areas:

1. **Keep `broadcast-store.ts` as a thin facade — new broadcast features should land in narrower slices.**
2. **`stt/detection.rs` is still multiple subsystems in one file — the live loop should delegate more to `pipeline`/`merger`.**
3. **Supabase lib is four copies of the same RPC template — one `callRpc` deletes a layer.**
4. **`resolveDetectionVerse` couples verse lookup to broadcast issue reporting — pure resolver + caller-side reporting.**
5. **Deepgram/Gladia key hooks are the same hook twice — generic `useApiKeySettings` is the obvious judo move.**

---

## 11. Open Questions

- [ ] Should `web/` get its own code-quality pass? (smaller surface, separate deploy)
- [ ] Decide whether the remaining broadcast facade should stay or call sites should move to narrower stores
- [ ] Detection split: Rust module names and migration order for `stt/detection.rs` peel
- [ ] Hymnal lazy-load: JSON chunks vs SQLite table vs Tauri asset bundle

---

### Appendix — review commands

```bash
# Line counts (PowerShell — exclude node_modules/target)
Get-ChildItem -Recurse src,src-tauri -Include *.ts,*.tsx,*.rs |
  Where-Object { $_.FullName -notmatch 'node_modules|target|\.test\.' } |
  ForEach-Object { (Get-Content $_.FullName | Measure-Object -Line).Lines, $_.FullName }

# Importers of broadcast store
rg "useBroadcastStore" src --count-matches

# Supabase RPC duplication scan
rg "failureMessage|Unable to reach" src/lib/supabase

# Files over 500 lines (bash)
find src src-tauri -name '*.ts' -o -name '*.tsx' -o -name '*.rs' |
  xargs wc -l | sort -n | tail -40
```
