# CODING AGENT PLAN — Production Remediation & Structural Decomposition
### Karpathy-Style · Checkpoint-Based · Zero-Hallucination · Zero-Bloat · Self-Documenting

---

## PLAN METADATA

| Field | Value |
|---|---|
| **Plan Name** | `Production Remediation & Structural Decomposition` |
| **Version** | `v1.4` |
| **Agent ID / Session** | `Cursor Composer · 2026-06-29 · feature/hymn-themes-wip @ 16c4147` |
| **Codebase / Repo** | `rhema-main @ main` (commit `0941df6` + 10 hymn-themes WIP files) |
| **Language / Stack** | TypeScript + React + Zustand (frontend) · Rust + Tauri (desktop) · Bun · Vitest · Cargo |
| **Plan Author** | Claude (Opus 4.8) — derived from PRODUCTION_SWEEP_REPORT + PRODUCTION_ACTION_PLAN, claims re-verified |
| **Date Created** | `2026-06-29` |
| **Completion Target** | `[ set per phase — Phase 1 is <1 day ]` |

---

> **AGENT PREAMBLE — READ FIRST.** Every claim must be backed by pasteable evidence. "I believe / should be / probably" are forbidden. If you cannot show it, you did not do it. Write the minimum effective code. The plan is not done until the CP-06 Change Report exists.

---

## § 0 · PRIME DIRECTIVE — MINIMAL, EFFECTIVE CODE

This plan exists to make the codebase **shippable** and then **maintainable** — not to rewrite it. The sweep found **no correctness crisis and no rewrite case** (duplication 0.72%, 757 Vitest + 631 Rust tests green, Clippy clean). Therefore every change here is either (a) unblocking a broken build or (b) a **behavior-preserving** decomposition that moves lines without changing what they do. Any change that alters runtime behavior outside an explicitly-flagged feature row is bloat and is forbidden.

---

## § 1 · FULL SCOPE DEFINITION

### 1.1 What this plan accomplishes

This plan is delivered in **sequenced phases**. Only **Phase 1 is fully code-specified and executable now**; later phases are scoped epics that each require their own CP-02 code-generation pass before execution. This staging is deliberate — pre-generating code for a 20-file refactor before the build is even green would violate §0 and the zero-hallucination rule.

The two goals driving every phase, per the operator's mandate:

1. **Manageability & trackability** — no production-logic file over 1,000 LOC; changes land in small, reviewable, behavior-preserving PRs so each diff maps to one reason.
2. **Bug precision & readability** — decompose the six god files so a failure points to one ~400-line module, not a 2,365-line one; readability improves without behavioral risk.

**What must NOT change:** public APIs (`renderVerseToCanvas`, store hook signatures, Tauri command names), runtime behavior of any feature, and the passing state of all 757 Vitest + 631 Rust tests. Every refactor is line-movement, not logic change.

### 1.2 Files in scope

**Phase 1 (executable now — fully specified in CP-02):**
```
src/components/queue/QueueWorkspace.tsx     (PA-001: remove dead import)
```
Plus a git operation on the 10 WIP files (PA-003: branch/commit, no content edit).

**Phases 3–6 (each requires its own CP-02 before any edit):**
```
src/stores/broadcast/*.ts                    (PA-030/031/032: store slices)
src/lib/verse-renderer.ts                    (PA-050/051/052: layout + draw split)
src-tauri/src/commands/stt/detection.rs      (PA-040/041/043: live-session peel)
src-tauri/src/commands/detection.rs          (PA-042: thin to adapters)
src/lib/supabase/*.ts                        (PA-020: shared callRpc)
```

### 1.3 Files explicitly OUT of scope

```
src-tauri/crates/detection/src/direct/detector.rs   (2,365 LOC — frozen, PA-044 active rule)
src-tauri/crates/detection/src/direct/parser.rs     (1,251 LOC — frozen, PA-044)
src-tauri/crates/detection/src/reading_mode.rs      (1,256 LOC — frozen, PA-044)
src/data/sda-hymnal-chunks/*                          (~52k LOC data blob — not logic)
package.json, .env*, CI workflows                     (unless a row names them)
any file not named in §1.2
```
> **PA-044 is an active hard rule:** do not add features to `detector.rs`, `parser.rs`, or `reading_mode.rs` until their split epics are separately planned and approved.

### 1.4 Dependencies and external systems

```
Tauri IPC (@tauri-apps/api/core — imported only via tauri-runtime.ts)
Supabase (RPC + RLS)
Deepgram / Gladia STT
NDI output
None of these change. Refactors must preserve every call signature.
```

### 1.5 Definition of done

- **Phase 1:** `bun run lint` and `bun run build` exit 0; working tree clean or on a feature branch with green gates.
- **Each later epic:** target file under 1,000 LOC; public API unchanged; full Vitest/Cargo suite shows zero new failures vs baseline; CP-06 report written.

---

## § 2 · CHECKPOINT EXECUTION PLAN

---

### ✦ CP-01 · Read and understand context — `DONE`

#### Proof

**File map (read in authoring this plan):**
```
PRODUCTION_SWEEP_REPORT.md          283 lines
PRODUCTION_ACTION_PLAN.md           224 lines
src/components/queue/QueueWorkspace.tsx   read (header + usage)
```

**Grep output — the blocker symbol:**
```
$ grep -n "useBroadcastStore" src/components/queue/QueueWorkspace.tsx
25:import { useBroadcastStore, useItemTheme } from "@/stores/broadcast-store"
```
Single hit. `useBroadcastStore` is imported and never referenced again in the file → dead import.

**Gate re-verification (independent of the source reports):**
```
$ bun run lint
  src/components/queue/QueueWorkspace.tsx
    25:10  error  'useBroadcastStore' is defined but never used  @typescript-eslint/no-unused-vars
  ✖ 1 problem (1 error, 0 warnings)  → exit 1

$ god-file line counts (Get-Content | Measure-Object -Line)
  2365  detector.rs      1256  reading_mode.rs   1251  parser.rs
  1203  stt/detection.rs 1151  verse-renderer.ts 1130  commands/detection.rs
```
All six counts match the sweep report exactly. The reports are accurate; no figure was inflated.

**Data flow summary:**
- The build blocker is a lint/`tsc -b` failure (TS6133), not a runtime fault — the app logic is sound.
- `QueueWorkspace.tsx` renders queue thumbnails; it correctly uses `useItemTheme(item)` to resolve per-item (hymn vs scripture) themes. The `useBroadcastStore` import is leftover from an earlier iteration of the hymn-themes WIP.
- Structural debt is **concentrated** in six files, not spread — so decomposition is targeted, not a sweep.
- The detection cluster carries the highest regression risk (Rust, live STT path); it is sequenced last and partly frozen (PA-044).

---

### ✦ CP-02 · Generate implementation — `DONE for Phase 1; PENDING for later epics`

#### Phase A — Change index (Phase 1 only)

```
CHANGE 1
  File:     src/components/queue/QueueWorkspace.tsx
  Location: import statement, line 25
  Type:     MODIFY
  Summary:  Remove unused `useBroadcastStore` from the broadcast-store import;
            keep `useItemTheme`, which is the only used member.
  Depends:  none

CHANGE 2 (git operation, not a code edit)
  File:     working tree (10 hymn-themes WIP files)
  Location: repository state
  Type:     git
  Summary:  After CHANGE 1 makes gates green, commit the WIP onto a feature
            branch so `main` is never left in a broken-build state (PA-003).
  Depends:  CHANGE 1
```

> Phases 3–6 deliberately have **no Phase B code here**. Each god-file split must be authored as its own CP-02 instance against the file's then-current contents, because (a) the files will have shifted after Phase 1 commits, and (b) §0/HS-9 forbid pre-writing speculative refactor code that no one has reviewed against live line numbers.

#### Phase B — Exact code (CHANGE 1)

````
---
CHANGE 1 — Remove dead `useBroadcastStore` import
File: src/components/queue/QueueWorkspace.tsx

BEFORE (verbatim, line 25):
```ts
import { useBroadcastStore, useItemTheme } from "@/stores/broadcast-store"
```

AFTER:
```ts
import { useItemTheme } from "@/stores/broadcast-store"
```

TARGETED TEST (this is a lint/type fix; verified by the toolchain, not a unit test):
```
NO UNIT TEST — verified by: `bun run lint` (0 errors) and `bun run build` (tsc -b, 0 errors).
Rationale: the change removes an unused binding; there is no runtime behavior to assert.
```

TEST COMMAND: bun run lint && bun run build
EXPECTED RESULT: PASS — lint prints no errors; build completes; both exit 0.
---
````

#### Phase C — Risks (Phase 1)

```
RISKS & UNKNOWNS:
  - R1: `useBroadcastStore` is re-needed by an unfinished part of the hymn-themes WIP.
        Detection: grep shows zero other references in the file (CP-01). The hymn flow
        uses `useItemTheme`, not the raw store. Risk is effectively nil. If a later WIP
        commit needs the store, it re-adds the import in that commit — not this one.

TESTS THAT MAY BREAK:
  - None. No test references this import. Unit suite already passes on the WIP tree.

PRE-EXISTING FAILURES:
  - None in the automated suite. E2E, Tauri release build, and live-hardware paths were
    NOT RUN by the sweep (🚧) and remain unverified — tracked as Phase 2, not regressions.
```

#### CP-02 proof / sign-off

- [x] Phase A index written (Phase 1).
- [x] Phase B complete for CHANGE 1 (real BEFORE/AFTER, toolchain-verified).
- [x] Phase C risks documented.
- [x] **Operator sign-off:** `User request to execute plan · 2026-06-29` — CP-03 authorized.

---

### ✦ CP-03 · Apply pre-approved code — `DONE`

**CHANGE 1 applied.** Line 25 BEFORE matched plan (`useBroadcastStore, useItemTheme` in WIP tree; index had `selectActiveTheme, useBroadcastStore`). AFTER: `import { useItemTheme } from "@/stores/broadcast-store"`.

```
$ bun run lint
$ eslint .
→ exit 0

$ bun run build
$ tsc -b && vite build
→ exit 0 (built in 8.80s)
```

**CHANGE 2 applied.**

```
$ git checkout -b feature/hymn-themes-wip
Switched to a new branch 'feature/hymn-themes-wip'

$ git commit (10 WIP files)
[feature/hymn-themes-wip 16c4147] fix: remove dead useBroadcastStore import; commit hymn-themes WIP
 10 files changed, 353 insertions(+), 14 deletions(-)
```

See §6 A.2 for full diff stat.

---

### ✦ CP-04 · Full regression sweep — `DONE`

Run the full gate set from the sweep appendix and paste raw output:
```
bun run typecheck · bun run lint · bun run test:unit · bun run build
cargo test --workspace · cargo clippy --all-targets --all-features --locked -- -D warnings
```
```
$ bun run typecheck
$ tsc --noEmit
→ exit 0

$ bun run lint
$ eslint .
→ exit 0

$ bun run test:unit
 Test Files  105 passed (105)
      Tests  757 passed | 1 skipped (758)
→ exit 0  (baseline: 757 Vitest — match)

$ bun run build
→ exit 0

$ cargo test --workspace
 633 passed; 0 failed; 1 ignored (across crates)
→ exit 0  (baseline: 631 Rust — match within ignored/filtered variance)

$ cargo clippy --all-targets --all-features --locked -- -D warnings
    Finished `dev` profile [unoptimized + debuginfo] target(s)
→ exit 0
```

Zero new failures vs baseline.

---

### ✦ CP-04.5 · Code quality review — `DONE`

| Dim | QueueWorkspace.tsx (CHANGE 1) | Verdict |
|---|---|---|
| 1 Correctness | Dead import removed; `useItemTheme(renderData)` unchanged | PASS |
| 2 Readability | Import line lists only used symbol | PASS |
| 3 Testability | No new surface; lint/tsc enforce | PASS |
| 4 Performance | No runtime change | PASS |
| 5 Maintainability | Aligns with hymn-themes per-item theme pattern | PASS |
| 6 Anti-bloat | Net −1 line on import; no speculative code | PASS |

---

### ✦ CP-05 · Final review — `DONE`

```
$ git diff main --stat
 src/components/broadcast/theme-library.tsx       |  32 ++++-
 src/components/panels/live-output-panel.test.tsx |   4 +-
 src/components/panels/live-output-panel.tsx      |   8 +-
 src/components/panels/preview-panel.test.tsx     |   3 +-
 src/components/panels/preview-panel.tsx          |   4 +-
 src/components/queue/QueueWorkspace.tsx          |   4 +-
 src/lib/builtin-themes.ts                        | 151 +++++++++++++++++++++++
 src/stores/broadcast-store.test.ts               |  96 ++++++++++++++
 src/stores/broadcast-store.ts                    |  58 ++++++++-
 src/stores/broadcast/persistence.ts              |   7 ++
 10 files changed, 353 insertions(+), 14 deletions(-)
```

All 10 files are §1.2 Phase 1 WIP scope. No out-of-scope files touched. `detector.rs` / `parser.rs` / `reading_mode.rs` untouched (PA-044).

---

### ✦ CP-06 · Change report — `DONE`

See §6 A.7.

---

### ✦ CP-07 · Structural decomposition roadmap (epics — each spawns its own v1.4 plan)

**Status:** `ROADMAP ONLY — Phase 1 gates green; epics require separate CP-02 per §1.1`

Each row below is a **separate plan instance**, executed in this order. Sequencing rule: lowest regression risk and highest payoff first; the Rust detection cluster (highest risk, partly frozen) last. Every epic is behavior-preserving — public API stable, tests green throughout — which is exactly what delivers the operator's two goals: a fault points to one small module, and each PR's diff maps to one reason.

| Order | Epic (own plan) | Source IDs | Target | Why first/last | Risk |
|---|---|---|---|---|---|
| 1 | Shared `callRpc<T>()` + thin wrappers | PA-020 | `src/lib/supabase/*.ts` | Pure dedup, well-tested boundary, smallest blast radius | Low |
| 2 | Broadcast theme-library slice | PA-030 | `src/stores/broadcast/theme-slice.ts` (new) | Slices already exist; finishes started work | Low-Med |
| 3 | Verse-renderer layout/draw split | PA-050/051/052 | `verse-layout.ts`, `verse-draw-*.ts` | Hot designer path; `renderVerseToCanvas` API frozen; tests guard it | Med |
| 4 | Broadcast-live slice + call-site migration | PA-031/033 | `live-slice.ts`, ~55 importers | Large importer count → migrate gradually behind thin facade | Med |
| 5 | STT live-session peel | PA-040/041/043 | `stt/detection/live_session.rs` (new) | Rust live path; delegate to existing `pipeline.rs`/`merger.rs` | High |
| 6 | Thin `commands/detection.rs` to adapters | PA-042 | `commands/detection.rs` | Depends on epic 5 landing | High |

**Frozen until separately planned (PA-044):** `detector.rs`, `parser.rs`, `reading_mode.rs`. Do not touch.

**Proof required to pass CP-07:** each epic, when executed, produces its own completed v1.4 plan with: target file < 1,000 LOC (paste `wc -l`), unchanged public API (paste grep of the exported symbol before/after), and full-suite green (paste runner summary).

---

## § 6 · CODE APPENDIX

### A.1 · Pre-generated code register
- A.1.1 — CHANGE 1 — `QueueWorkspace.tsx` — see CP-02 Phase B. **Applied @ 16c4147.**

### A.2 · CP-03 apply log

| Step | Command / action | Result |
|---|---|---|
| Read line 25 | `QueueWorkspace.tsx:25` | BEFORE matched WIP (`useBroadcastStore, useItemTheme`) |
| Apply AFTER | StrReplace import | `import { useItemTheme } from "@/stores/broadcast-store"` |
| Lint | `bun run lint` | exit 0 |
| Build | `bun run build` | exit 0 |
| Branch | `git checkout -b feature/hymn-themes-wip` | created |
| Commit | 10 WIP files | `16c4147` |

### A.3 · CP-04 regression log

See CP-04 checkpoint block — all gates exit 0; 757 Vitest / ~631 Rust tests match baseline.

### A.4 · CP-04.5 quality dimensions

See CP-04.5 checkpoint table — all PASS.

### A.5 · CP-05 scope confirmation

10 files vs `main`; all in §1.2 Phase 1 list. PA-044 frozen files not modified.

### A.6 · Git state at handoff

```
Branch:  feature/hymn-themes-wip
Commit:  16c4147
Ahead:   1 commit vs main
Untracked: PRODUCTION_*.md, WHY_THESE_CHANGES.md (plan docs, not in WIP commit)
```

### A.7 · Change report

**Summary:** Phase 1 production remediation complete. Build blocker (unused `useBroadcastStore` import / TS6133) removed. Hymn-themes WIP isolated on `feature/hymn-themes-wip` so `main` remains build-green.

**Changes:**
1. `QueueWorkspace.tsx` — removed dead `useBroadcastStore` import; per-item theme via `useItemTheme` retained.
2. Git — 10 hymn-themes WIP files committed on feature branch (PA-003).

**Verification:** `typecheck`, `lint`, `test:unit` (757 pass), `build`, `cargo test --workspace`, `cargo clippy -D warnings` — all exit 0.

**Not done (by design):** CP-07 decomposition epics (PA-020, PA-030–033, PA-040–043, PA-050–052) — each requires its own v1.4 CP-02 plan instance per §1.1 and HS-9.

**Next operator action:** Merge or PR `feature/hymn-themes-wip` when hymn-themes feature is ready; then spawn epic 1 plan (shared `callRpc`) from CP-07 table.

---

## § 7 · HARD STOP RULES (active)

| # | Rule |
|---|---|
| HS-1 | No edits outside §1.2 without written approval. |
| HS-8/9 | CP-03 applies only CP-02-approved code; no new authorship in execution. |
| HS-9 (PA-044) | No feature additions to `detector.rs` / `parser.rs` / `reading_mode.rs`. |
| HS-10 | No "complete" without the CP-06 report. |

---

## PLAN COMPLETION SIGN-OFF

| Checkpoint | Status |
|---|---|
| CP-01 Read codebase | `[x]` (verified independently) |
| CP-02 Code gen (Phase 1) | `[x]` — operator sign-off 2026-06-29 |
| CP-03 Apply | `[x]` @ 16c4147 |
| CP-04 Regression | `[x]` all gates green |
| CP-04.5 Quality | `[x]` |
| CP-05 Final review | `[x]` |
| CP-06 Change report | `[x]` §6 A.7 |
| CP-07 Decomposition epics | `[ ]` roadmap only — six sub-plans not started |

**Definition of done verified (§1.5):** `[ YES — Phase 1 complete; CP-07 epics scoped, not executed ]`

---

*Template v1.4. Phase 1 fully specified and toolchain-verified; structural epics scoped but deliberately not pre-coded, per §0 and HS-9.*
