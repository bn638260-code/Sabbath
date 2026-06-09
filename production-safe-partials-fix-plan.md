# CODING AGENT PLAN — Address SabbathCue Review Partials

## Karpathy-Style · Checkpoint-Based · Zero-Hallucination · Template v1.3

---

## PLAN METADATA

| Field | Value |
| --- | --- |
| **Plan Name** | Address production-safe review Partials (modularity, tests, fail-safe) |
| **Version** | `v1.3` |
| **Agent ID / Session** | `[ fill in at execution ]` |
| **Codebase / Repo** | `SabbathCue @ main` (local: `c:\Users\fanel\Downloads\rhema-main\rhema-main`) |
| **Language / Stack** | TypeScript + React 19 (Vite) frontend; Rust (Tauri v2) backend; GitHub Actions CI |
| **Plan Author** | SabbathCue maintainer (operator) |
| **Date Created** | 2026-06-09 |
| **Completion Target** | `[ fill in ]` |

---

> **AGENT PREAMBLE — READ THIS FIRST, EVERY TIME**
>
> You are a coding agent executing a plan written by a human. You are capable of excellent execution but you are NOT capable of reliable self-assessment. Every claim you make about what you have done must be backed by irrefutable, pasteable, observable evidence. "I believe", "I think", "should be", "likely", and "probably" are **forbidden status words** in this plan. If you cannot show it, you did not do it. When in doubt: halt and ask. Uncertainty reported is far less costly than a silent wrong action.

This plan exists to resolve the three **Partial** verdicts from `production-safe-code-review-sabbathcue.md`:

- Criterion 2 (modularity): dead `rhema-notes` crate + inconsistent IPC.
- Criterion 3 (tests): zero NDI tests, untested `validation.rs`, E2E not gated in CI.
- Criterion 4 (fail-safe): transcript debug logging can leak spoken content; silent operator-facing failures.

---

## § 1 · FULL SCOPE DEFINITION

> **HARD STOP:** Read and confirm full understanding of this section before touching a single file.

### 1.1 What this plan accomplishes

Resolve the code-addressable Partials without changing app behavior for end users:

1. **Remove dead code** — delete the orphaned `rhema-notes` crate and correct the docs that still describe "7 crates".
2. **Standardize IPC** — route every direct `invoke()` call in the frontend through the existing `invokeTauri()` runtime guard (`src/lib/tauri-runtime.ts`). Event APIs (`listen`/`emitTo`) are explicitly out of scope.
3. **Close fail-safe gaps** — (a) make transcript debug logging impossible in release builds and stop logging the keyterm-laden Deepgram URL query; (b) surface operator-visible failures that are currently swallowed silently.
4. **Add tests** — unit tests for `validation.rs` and the NDI broadcast crate (extracting one pure helper to make the frame conversion testable), and a CI-gated Playwright E2E step.

**Must NOT change:** user-facing behavior of transcription, detection, broadcast output, or remote control; the public command names/signatures; the NDI frame bytes actually sent on the wire (the E2 refactor is behavior-preserving); any persisted store schema.

### 1.2 Files in scope — every file the agent is allowed to modify

```text
# Group A — remove dead crate + doc hygiene
src-tauri/crates/notes/                         (DELETE entire directory)
README.md
.github/CONTRIBUTING.md
web/content/docs/architecture/rust-crates.mdx
web/content/docs/architecture/project-structure.mdx
web/content/docs/architecture/tech-stack.mdx
web/content/docs/index.mdx
docs/procurement/README.md

# Group B — IPC standardization
src/lib/context-search.ts
src/lib/context-search.test.ts
src/lib/theme-designer-files.ts
src/hooks/use-assets.ts
src/hooks/use-transcription.ts
src/hooks/use-broadcast-output-runtime.ts
src/components/layout/operator-status-actions.tsx
src/components/panels/search-panel.tsx
src/components/settings-dialog.tsx
src/components/broadcast/broadcast-settings.tsx

# Group C — logging safety
src-tauri/src/commands/stt.rs
src-tauri/crates/stt/src/deepgram.rs

# Group D — surface silent failures
src/hooks/use-assets.ts                         (shared with Group B)
src/stores/broadcast-store.ts
src/components/broadcast/broadcast-settings.tsx (shared with Group B)

# Group E — tests + CI
src-tauri/src/commands/validation.rs
src-tauri/crates/broadcast/src/ndi.rs
.github/workflows/desktop-ci.yml
```

### 1.3 Files explicitly OUT of scope — must not be touched

```text
src-tauri/Cargo.toml        (rhema-notes is NOT a member; no edit needed — confirmed in CP-01)
src-tauri/Cargo.lock        (rhema-notes never locked; no edit needed)
web/public/docs/diagrams/diagram-crate-dependencies.svg   (optional; needs operator OK)
web/public/docs/diagrams/diagram-stack-layers.svg         (optional; needs operator OK)
Any frontend event-API call site (listen / emitTo)        (wrapper does not cover these)
src/hooks/use-tauri-event.ts, src/hooks/use-remote-control.ts (listen-only; out of scope)
Any file not listed in §1.2
```

### 1.4 Dependencies and external systems involved

```text
@tauri-apps/api/core  (invoke)        — wrapped by src/lib/tauri-runtime.ts invokeTauri
sonner                 (toast)         — user-facing error surface
@playwright/test                       — E2E runner (test:e2e script already exists)
Rust: url crate (Deepgram URL build), thiserror (NdiError), serde (NDI request round-trip)
GitHub Actions (windows-latest)        — desktop-ci.yml frontend job
```

### 1.5 Definition of done

```text
- rhema-notes crate directory no longer exists; `cargo metadata` lists 6 crates + root; docs say "6 crates".
- No production file under src/ imports `invoke` from "@tauri-apps/api/core" except src/lib/tauri-runtime.ts.
- transcript_logging_enabled() returns false in release builds regardless of env var (proven by unit test on the extracted pure helper).
- Deepgram URL log no longer contains the query string / keyterms (proven by unit test on the extracted redactor).
- asset_status failure shows a toast; no remaining empty `.catch(() => {})` on the broadcast-sync sites in §1.2 Group D.
- New Rust tests exist and pass: validation.rs (>=5 cases), ndi.rs (dimensions/fps/NdiError/serde + frame conversion helper).
- desktop-ci.yml frontend job runs Playwright; `bun run test:e2e` passes locally.
- `bun run typecheck`, `bun run lint`, `bun run test -- --run` all pass; `cargo test --workspace` and `cargo clippy --workspace --all-targets` pass.
- No files outside §1.2 were modified.
```

> **Agent instruction:** You cannot proceed past §1 until every field above is confirmed.

---

## § 2 · CHECKPOINT EXECUTION PLAN

> **RULE:** Checkpoints are sequential and non-skippable. Prove checkpoint N before starting N+1.

---

### ✦ CP-01 · Read and understand the full codebase context

**Status:** `PENDING`

#### Instructions

1. Read every file in §1.2 in full. For Group B, confirm each direct `invoke(` import and call site still matches the inventory below.
2. Trace IPC data flow: UI/hook/store -> `invoke`/`invokeTauri` -> Tauri command (`src-tauri/src/commands/*`) -> managed state -> `Result<T,String>` back to JS.
3. Confirm `rhema-notes` has zero build references.
4. Run the grep commands listed below and paste raw output.
5. Identify existing tests touching the code in scope.

#### Required grep commands (paste raw output into the proof block)

```bash
# IPC: every direct core-invoke import that must be migrated
rg -n "from \"@tauri-apps/api/core\"" src
# Dead crate: must return only the crate's own files + docs (no Cargo/lock/build refs)
rg -n "rhema-notes|rhema_notes|crates/notes" .
# Confirm rhema-notes absent from workspace + lockfile
rg -n "notes" src-tauri/Cargo.toml src-tauri/Cargo.lock
```

#### Proof required to pass CP-01

- [ ] **File map:** list of every file read with line counts.
- [ ] **Grep output:** raw output of the three commands above.
- [ ] **Data flow summary:** 3-5 bullets in your own words.

```text
[ Agent pastes proof here ]
```

---

### ✦ CP-02 · Generate the complete implementation — plan + exact code + tests

**Status:** `PENDING`

> All code is generated here and reviewed before any file is touched. CP-03 is transcription + verification only.

#### Phase A — Change index

```text
CHANGE A1
  File:     src-tauri/crates/notes/  (Cargo.toml + src/lib.rs)
  Location: entire directory
  Type:     DELETE
  Summary:  Remove the orphaned rhema-notes stub crate (not a workspace member, no deps, not in Cargo.lock).
  Depends:  none

CHANGE A2
  File:     README.md
  Location: lines ~68, ~84, ~256
  Type:     MODIFY
  Summary:  Change "workspace with 7 crates" -> "6 crates"; drop the rhema-notes table row; remove the notes/ tree line.
  Depends:  A1

CHANGE A3
  File:     .github/CONTRIBUTING.md
  Location: lines ~5, ~73
  Type:     MODIFY
  Summary:  "seven crates ... and notes" -> six crates; remove the notes placeholder tree line.
  Depends:  A1

CHANGE A4
  File:     web/content/docs/architecture/rust-crates.mdx
  Location: description (l3), table row (l21), bullet (l51-53), prose (l59), tree (l69)
  Type:     MODIFY
  Summary:  Remove rhema-notes row/bullet/tree entry; "Seven" -> "Six".
  Depends:  A1

CHANGE A5
  File:     web/content/docs/architecture/project-structure.mdx
  Location: line ~43
  Type:     MODIFY
  Summary:  Remove the notes/ placeholder <File> line.
  Depends:  A1

CHANGE A6
  File:     web/content/docs/architecture/tech-stack.mdx
  Location: lines ~12, ~41
  Type:     MODIFY
  Summary:  "seven crates" -> "six crates" (two occurrences).
  Depends:  A1

CHANGE A7
  File:     web/content/docs/index.mdx  AND  docs/procurement/README.md
  Location: index.mdx l86; procurement README l26
  Type:     MODIFY
  Summary:  "7 crates" -> "6 crates" in both card/line.
  Depends:  A1

CHANGE B1
  File:     src/lib/context-search.ts
  Location: import (l2), call site (l44)
  Type:     MODIFY
  Summary:  Import invokeTauri from "@/lib/tauri-runtime"; replace invoke<...>("get_translation_verses_for_search").
  Depends:  none

CHANGE B2
  File:     src/lib/context-search.test.ts
  Location: mock (l7-14) + assertions
  Type:     MODIFY
  Summary:  Mock "@/lib/tauri-runtime" invokeTauri instead of "@tauri-apps/api/core" invoke; rename mock var.
  Depends:  B1

CHANGE B3
  File:     src/lib/theme-designer-files.ts
  Location: import (l2), call sites (l22, l34, l49)
  Type:     MODIFY
  Summary:  Swap to invokeTauri for read_image_as_data_url / export_theme_to_path / import_theme_from_path.
  Depends:  none

CHANGE B4
  File:     src/hooks/use-assets.ts
  Location: import (l2), call site (l25)
  Type:     MODIFY
  Summary:  Swap asset_status to invokeTauri (toast added separately in D1).
  Depends:  none

CHANGE B5
  File:     src/hooks/use-transcription.ts
  Location: import (l2), call sites (l53, l72)
  Type:     MODIFY
  Summary:  Swap start_transcription / stop_transcription to invokeTauri.
  Depends:  none

CHANGE B6
  File:     src/hooks/use-broadcast-output-runtime.ts
  Location: import (l2), call sites (l172, l264)
  Type:     MODIFY
  Summary:  Swap push_ndi_frame / get_ndi_status to invokeTauri.
  Depends:  none

CHANGE B7
  File:     src/components/layout/operator-status-actions.tsx
  Location: import (l1), call site (l60)
  Type:     MODIFY
  Summary:  Swap stop_reading_mode to invokeTauri (keep .catch console.error).
  Depends:  none

CHANGE B8
  File:     src/components/panels/search-panel.tsx
  Location: import (l10), call sites (l307, l397, l579, l609)
  Type:     MODIFY
  Summary:  Swap semantic_search / get_chapter / set_active_translation (x2) to invokeTauri.
  Depends:  none

CHANGE B9
  File:     src/components/settings-dialog.tsx
  Location: import (l10), 16 call sites
  Type:     MODIFY
  Summary:  Swap all invoke() command calls to invokeTauri (audio/secrets/bible/remote). Keep dynamic listen import as-is.
  Depends:  none

CHANGE B10
  File:     src/components/broadcast/broadcast-settings.tsx
  Location: import (l2 invoke only; keep emitTo/listen import l3), 17 call sites
  Type:     MODIFY
  Summary:  Swap all invoke() to invokeTauri; leave emitTo/listen imports and calls unchanged.
  Depends:  none

CHANGE C1
  File:     src-tauri/src/commands/stt.rs
  Location: transcript_logging_enabled() (l60-67)
  Type:     MODIFY
  Summary:  Extract pure transcript_logging_decision(is_debug_build, env_value) and force false in release; add tests.
  Depends:  none

CHANGE C2
  File:     src-tauri/crates/stt/src/deepgram.rs
  Location: build_url() (l48-69) + new helper
  Type:     MODIFY
  Summary:  Add pure redact_ws_url_query(&Url)->String; log redacted endpoint instead of full URL with keyterms; add test.
  Depends:  none

CHANGE D1
  File:     src/hooks/use-assets.ts
  Location: refresh() catch (l24-27)
  Type:     MODIFY
  Summary:  On asset_status failure, toast.error with stable id; keep setStatus(null).
  Depends:  B4

CHANGE D2
  File:     src/stores/broadcast-store.ts
  Location: emitDraftToBroadcast (l153-166), syncBroadcastOutputFor (l286-290)
  Type:     MODIFY
  Summary:  Replace empty .catch(() => {}) with .catch((e) => console.warn(...context...)).
  Depends:  none

CHANGE D3
  File:     src/components/broadcast/broadcast-settings.tsx
  Location: syncNdiConfigToOutput emit (l189-194), post-start emits (l357-360, l455-460), handleAltToggle (l475, l479)
  Type:     MODIFY
  Summary:  Replace empty .catch(() => {}) on emit/sync with console.warn; wrap handleAltToggle invoke catches with showBroadcastError.
  Depends:  B10

CHANGE E1
  File:     src-tauri/src/commands/validation.rs
  Location: new #[cfg(test)] mod tests at EOF
  Type:     ADD
  Summary:  Add unit tests for bounded_text, bounded_limit, bounded_optional_limit, valid_confidence_threshold, valid_port.
  Depends:  none

CHANGE E2
  File:     src-tauri/crates/broadcast/src/ndi.rs
  Location: extract pure convert_rgba_to_bgra_into + validate_frame_dimensions; new #[cfg(test)] mod tests
  Type:     MODIFY (extract) + ADD (tests)
  Summary:  Move RGBA->BGRA + size/dimension checks into free fns called by send_frame_rgba; test them plus dimensions/fps/NdiError/serde.
  Depends:  none

CHANGE E3
  File:     .github/workflows/desktop-ci.yml
  Location: frontend job, after "Build frontend" (l36), before "npm audit" (l38)
  Type:     ADD
  Summary:  Add "Install Playwright browsers" (npx playwright install chromium) + "E2E tests" (bun run test:e2e, env CI=true).
  Depends:  none
```

---

#### Phase B — Exact code per change

> The complete BEFORE/AFTER/test blocks for every change are stored in **§6 Appendix A.1** (the authoritative, lockable register). Each A.1.x entry maps 1:1 to a CHANGE id above.

See §6 · A.1.

---

#### Phase C — Risks before any code is applied

```text
RISKS & UNKNOWNS:
  - R1 (E2 NDI refactor): extracting RGBA->BGRA/validation from send_frame_rgba could alter the bytes sent.
    Detection: new unit test asserts byte-for-byte output equals the current inline logic for all 3 alpha modes;
    cargo clippy must stay clean. The live send path (unsafe FFI) is untouched.
  - R2 (B9/B10 large diffs): settings-dialog (16) and broadcast-settings (17) have many call sites; risk of a missed
    site or accidental event-API change. Detection: post-change `rg "invoke\(" <file>` returns zero core-invoke uses;
    emitTo/listen imports unchanged in git diff; tsc + lint pass.
  - R3 (B2 test mock): tests mocking "@tauri-apps/api/core" will break once production code imports invokeTauri.
    Detection: targeted vitest run for context-search.test.ts (and any other mock of that module) goes red->green.
  - R4 (C1 release gating): cannot exercise the release branch under `cargo test` (tests run in debug).
    Mitigation: logic extracted into a pure fn taking is_debug_build as a parameter; test both true/false explicitly.
  - R5 (D1 toast noise): asset_status refreshes on mount and manual refresh; a stable toast id de-dupes repeats.
  - R6 (E3 CI cost/flake): Playwright adds runtime; webServer builds via npm. Detection: CI run is green;
    reuseExistingServer:!CI means a fresh server in CI.

TESTS THAT MAY BREAK:
  - src/lib/context-search.test.ts — intentional (B2 updates the mock). Will be fixed in the same change.
  - No other existing test references the migrated modules' mocks (confirm via CP-01 grep before applying).

PRE-EXISTING FAILURES:
  - [ Record the pre-plan baseline here in CP-01: run `cargo test --workspace` and `bun run test -- --run` once and note any
    already-failing tests so they are not attributed to this plan. ]
```

#### Proof required to pass CP-02

- [ ] Phase A change index complete (above).
- [ ] Phase B: every CHANGE has a BEFORE/AFTER/TARGETED TEST block in §6 A.1.
- [ ] Phase C: risks, expected breakages, pre-existing failures documented.
- [ ] Human operator reviewed all A.1 code and signed off.
- [ ] No code applied yet.

```text
Human operator sign-off: [ NAME / DATE ]
Notes from review: [ ... ]
```

---

### ✦ CP-03 · Apply pre-approved code — atomic change→test loop

**Status:** `PENDING`

> The agent applies the A.1 AFTER blocks exactly, verifies the diff, type-checks, runs the pre-specified test, and logs to A.2. No authorship. Respect `Depends` ordering (apply B1 before B2, B4 before D1, B10 before D3). Any needed deviation -> HALT and report (see §3A / §7 HS-8).

#### Atomic loop (per CHANGE)

```text
1 LOCATE the A.1 entry (BEFORE / AFTER / TEST).
2 READ the target file; confirm it matches BEFORE exactly. If not -> HALT (scope integrity).
3 APPLY the AFTER block verbatim. One change only.
4 VERIFY: git diff <file> matches the AFTER block.
5 COMPILE: tsc --noEmit (frontend) or cargo check -p <crate> (rust). 0 errors.
6 TEST: run the exact TEST COMMAND from A.1. Paste output.
7 CONFIRM: PASS -> log A.2, next change. FAIL -> STOP, diagnose, report.
```

#### Proof required to pass CP-03

For every change, §6 A.2 must contain: `git diff` matching A.1 AFTER, compiler output (0 errors), and the targeted test output (PASS). New tests must show red->green where applicable.

---

### ✦ CP-04 · Full regression sweep

**Status:** `PENDING`

#### Regression Instructions

1. `cd src-tauri && cargo test --workspace` — entire suite.
2. `cd src-tauri && cargo clippy --workspace --all-targets` — zero new warnings.
3. `bun run typecheck` — 0 errors (whole codebase).
4. `bun run lint` — clean.
5. `bun run test -- --run` — full Vitest suite.
6. `bun run test:e2e` — Playwright spec passes.
7. Any new failure is this plan's responsibility; do not soften assertions. Pre-existing failures from CP-01 baseline are flagged, not fixed.

#### Proof required to pass CP-04

- [ ] Full test-runner output (Rust + Vitest + Playwright) pasted into A.3.
- [ ] Full type-checker output (`0 errors`).
- [ ] Failure count equal to or lower than the CP-01 baseline (zero new failures).

```text
[ paste outputs into §6 A.3 ]
```

---

### ✦ CP-04.5 · Code quality review

**Status:** `PENDING`

Work the five §3B dimensions (Readability/Naming, Error Handling/Edge Cases, Security/Safety, Performance, Structure/Maintainability) for every changed file. Log per-file verdicts in §6 A.4 with explicit PASS / ISSUE / APPLICABLE / NOT APPLICABLE. Resolve every ISSUE and re-run its targeted test. State one verdict: `QUALITY PASS` / `QUALITY PASS WITH NOTES` / `QUALITY FAIL`.

Focus items for this plan:

- C1/C2 and E2 (security & correctness): confirm no secret/keyterm leakage remains; confirm byte-identical NDI output.
- B9/B10 (structure): confirm only `invoke`->`invokeTauri` changed; no event-API drift.

```text
[ Agent states quality verdict here; full log in §6 A.4 ]
```

---

### ✦ CP-05 · Final review

**Status:** `PENDING`

#### Final Review Instructions

1. `git diff main` — read every line.
2. Confirm no files outside §1.2 were modified.
3. Confirm no debug code / `console.log` / `TODO` / `FIXME` / commented-out blocks were left.
4. Plain-English summary of every change for a reviewer.
5. Verify §1.5 definition of done is fully satisfied.

#### Proof required to pass CP-05

- [ ] Full `git diff main` output.
- [ ] Every changed file listed with one sentence.

```text
[ Agent pastes final git diff + file list here ]
```

---

## § 3 · TOOL CALLING PROTOCOL (condensed from template v1.3)

Golden rule: every tool call has a declared purpose; read the full output before the next call.

- `read_file` — before modifying ANY file. No write to an unread file.
- `write`/`edit` — only after CP-02 sign-off and after reading the target. One file per call. Immediate `git diff`.
- `bash` — tests, grep, build, lint, git only. Paste full stdout + exit code.
- `grep`/`rg` — before renaming a symbol, adding an import, or assuming absence. Paste raw output.
- `git diff` — after every write and before CP handoff. Must match the planned A.1 AFTER block.

Forbidden: writing an unread file; speculative bash; ignoring tool output; multi-file heredocs; `sed -i`/`awk` without read-back; vague-goal calls.

---

## § 3A · MICRO-TEST PROTOCOL

The test for each change lives in its §6 A.1 block (`TARGETED TEST` + `TEST COMMAND` + `EXPECTED RESULT`). Run the command verbatim. For new tests, run red (before) then green (after) and paste both. If a change has no test, it must say `NO UNIT TEST — verified by: [compiler/lint/integration]`. On failure: stop, decide code-vs-test fault, do not edit either without operator approval, log in A.6.

Targeted commands used by this plan:

```bash
# Rust single module
cd src-tauri && cargo test -p rhema-broadcast ndi::tests
cd src-tauri && cargo test validation::tests
cd src-tauri && cargo test -p rhema-stt deepgram::tests::redacts
cd src-tauri && cargo test transcript_logging
# Frontend single file
bunx vitest run src/lib/context-search.test.ts
# Whole-frontend gates
bun run typecheck && bun run lint
# E2E
bun run test:e2e
```

---

## § 3B · CODE QUALITY RUBRIC (applies in CP-02 Phase B and CP-04.5)

Naming: verbs for functions, `is/has` booleans, domain-named variables, no generic `data/result/temp`.
Function size: one responsibility, <~40 lines unless justified.
Error handling: every external call handled; errors carry context; consistent pattern; fail loud, never silent-corrupt.
Security (hard fails): no secret/token in logs or errors; validate input at the boundary; no raw SQL interpolation; sanitize path input.
Tests: scenario-named, behavior-focused, independent, edge cases covered, no test that passes on dead code.
Comments: explain WHY, not WHAT; no leftover TODO/FIXME without a ticket.

Scoring: A (clean) / B (minor notes) / C (issues fixed in-review) / D (unresolved — operator review) / F (hard failure — halt). D or F => QUALITY FAIL.

---

## § 4 · FAILURE MODES (countermeasures, condensed)

- Compiler/type error -> read full error, find root cause, targeted fix, re-run. No guess-patching.
- A previously-passing test breaks -> regression; fix implementation, not the test (unless the test covers in-scope behavior, e.g. B2 — then update test and log in A.6).
- Scope creep (need a file outside §1.2) -> HALT, ask operator, update §1.2 only if approved.
- Ambiguity -> HALT, ask one specific question.
- Quality fail -> resolve the dimension, re-run targeted test, log in A.4.
- Dependency behaves oddly -> minimal repro, cite docs URL, report before adapting.
- Git conflict -> do not auto-resolve; `git status`/`git diff`, report.
- Lost state -> `git diff main` + `git status` to re-establish ground truth; resume from last proven checkpoint.

Stuck > 2 attempts: write down attempts + output, re-read code fresh, binary-search the failure, and after 3 attempts produce a minimal repro for the operator. Never call a failed attempt "almost working".

---

## § 5 · PROOF & ANTI-HALLUCINATION PROTOCOL

Zero tolerance for unverifiable claims. Forbidden status words: "I believe/think/likely/should be/probably". Valid proof = raw terminal output, `git diff`, file read-back, test pass/fail counts, compiler `0 errors`, doc URL + cited sentence.

Hallucination tripwires (declare `HALT: <name>` and wait):

- H.1 claim a file changed without a `git diff`.
- H.2 claim tests pass without runner output.
- H.3 reference a symbol absent from CP-01 grep.
- H.4 state a library API without a docs URL.
- H.5 mark a checkpoint done without its proofs.
- H.6 cross a scope boundary without approval.
- H.7 say "no errors" without compiler output.
- H.8 apply code differing from the A.1 AFTER block without sign-off.
- H.9 write new code in CP-03 not present in any A.1 AFTER block.

---

## § 6 · CODE APPENDIX (append-only)

### A.1 · Pre-generated code register (CP-02 Phase B — authoritative, lockable)

> **Convention for Group B (IPC):** every entry is a pure rename — swap the import to `invokeTauri` from `@/lib/tauri-runtime` and replace each `invoke(` token with `invokeTauri(`. No arguments, types, control flow, `.catch`, or event-API calls change. Line-level BEFORE/AFTER pairs are shown because the rename is identical in shape everywhere.

#### Group A — Remove dead `rhema-notes` crate + doc hygiene

````text
A.1.A1 — CHANGE A1 — src-tauri/crates/notes/ — delete orphaned crate

BEFORE (src-tauri/crates/notes/Cargo.toml — verbatim):
```toml
[package]
name = "rhema-notes"
version = "0.1.0"
edition = "2021"

[lints]
workspace = true

[dependencies]
serde.workspace = true
serde_json.workspace = true
log.workspace = true
thiserror.workspace = true
```
BEFORE (src-tauri/crates/notes/src/lib.rs — verbatim):
```rust
//! Sermon notes and export for the SabbathCue application.
//!
//! Planned: Claude API integration, sermon note generation,
//! and PDF/Markdown export.
```

AFTER: NO FILE — delete the entire `src-tauri/crates/notes/` directory (both files above).

NO UNIT TEST — verified by: `cd src-tauri && cargo metadata --no-deps --format-version 1` lists exactly the root + 6 crates (no rhema-notes), and `cargo check --workspace` returns 0 errors. `Cargo.toml`/`Cargo.lock` need NO edit (CP-01 confirmed rhema-notes is not a member and not locked).
TEST COMMAND: cd src-tauri && cargo check --workspace
EXPECTED RESULT: PASS — compiles; rhema-notes absent from `cargo metadata`.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.A2 — CHANGE A2 — README.md — drop "7 crates" + rhema-notes row + tree line

BEFORE (line 68):
```md
| **Backend** | Tauri v2, Rust (workspace with 7 crates) |
```
AFTER:
```md
| **Backend** | Tauri v2, Rust (workspace with 6 crates) |
```

BEFORE (line 83-84):
```md
| `rhema-api` | Tauri command API layer |
| `rhema-notes` | (placeholder) |
```
AFTER:
```md
| `rhema-api` | Tauri command API layer |
```

BEFORE (line 255-256):
```md
│   │   ├── api/                  # Tauri command layer
│   │   └── notes/                # (placeholder)
```
AFTER:
```md
│   │   └── api/                  # Tauri command layer
```

NO UNIT TEST — verified by: `rg -n "rhema-notes|7 crates|notes/" README.md` returns no matches.
TEST COMMAND: rg -n "rhema-notes|workspace with 7 crates|notes/" README.md
EXPECTED RESULT: PASS — no matches.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.A3 — CHANGE A3 — .github/CONTRIBUTING.md — six crates, drop notes

BEFORE (line 5):
```md
SabbathCue is a Tauri v2 desktop app. The frontend is React 19 + TypeScript + Tailwind + Zustand; the backend is a Rust workspace with seven crates under `src-tauri/crates/` (audio, STT, Bible/FTS, verse detection, NDI broadcast, Tauri command API, and notes). Bun is the package manager and the runtime for the data pipeline scripts. Contributions on either side are welcome.
```
AFTER:
```md
SabbathCue is a Tauri v2 desktop app. The frontend is React 19 + TypeScript + Tailwind + Zustand; the backend is a Rust workspace with six crates under `src-tauri/crates/` (audio, STT, Bible/FTS, verse detection, NDI broadcast, and Tauri command API). Bun is the package manager and the runtime for the data pipeline scripts. Contributions on either side are welcome.
```

BEFORE (line 72-73):
```md
│   │   ├── api           Tauri command layer
│   │   └── notes         (placeholder)
```
AFTER:
```md
│   │   └── api           Tauri command layer
```

NO UNIT TEST — verified by: `rg -n "seven crates|and notes|notes " .github/CONTRIBUTING.md` returns no stale matches.
TEST COMMAND: rg -n "seven crates|notes" .github/CONTRIBUTING.md
EXPECTED RESULT: PASS — no matches.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.A4 — CHANGE A4 — web/content/docs/architecture/rust-crates.mdx — six crates

BEFORE (line 3):
```mdx
description: Seven workspace crates, each with one job — audio, STT, Bible, detection, broadcast, API, and notes.
```
AFTER:
```mdx
description: Six workspace crates, each with one job — audio, STT, Bible, detection, broadcast, and API.
```

BEFORE (line 20-21):
```mdx
| `rhema-api` | Tauri command API layer — the only crate that touches Tauri |
| `rhema-notes` | (placeholder for upcoming sermon notes feature) |
```
AFTER:
```mdx
| `rhema-api` | Tauri command API layer — the only crate that touches Tauri |
```

BEFORE (line 51-53):
```mdx
- **`rhema-notes`** is a placeholder. Its `lib.rs` reads
  *"Planned: Claude API integration, sermon note generation, and
  PDF/Markdown export"* — none of that is implemented yet.
```
AFTER: (delete these three lines entirely)

BEFORE (line 57):
```mdx
![Dependency graph of the seven Rust crates fanning out from rhema-api with two internal cross-deps](/docs/diagrams/diagram-crate-dependencies.svg)
```
AFTER:
```mdx
![Dependency graph of the six Rust crates fanning out from rhema-api with two internal cross-deps](/docs/diagrams/diagram-crate-dependencies.svg)
```

BEFORE (line 59):
```mdx
*The fan-out from `rhema-api` down through audio, stt, bible, detection, broadcast, and notes. Edges are strictly downward; no cycles. **Click to expand.***
```
AFTER:
```mdx
*The fan-out from `rhema-api` down through audio, stt, bible, detection, and broadcast. Edges are strictly downward; no cycles. **Click to expand.***
```

BEFORE (line 68-69):
```mdx
├── rhema-broadcast
└── rhema-notes
```
AFTER:
```mdx
└── rhema-broadcast
```

NO UNIT TEST — verified by: `rg -n "rhema-notes|Seven|and notes" web/content/docs/architecture/rust-crates.mdx` returns no matches; `bun run web:build` succeeds.
TEST COMMAND: rg -n "rhema-notes|Seven|and notes" web/content/docs/architecture/rust-crates.mdx
EXPECTED RESULT: PASS — no matches.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.A5 — CHANGE A5 — web/content/docs/architecture/project-structure.mdx — drop notes tree line

BEFORE (line ~43, re-read exact in CP-03 STEP 2):
```mdx
        <File name="notes/       — (placeholder)" />
```
AFTER: (delete the line)

NO UNIT TEST — verified by: `rg -n "notes" web/content/docs/architecture/project-structure.mdx` returns no stale matches; `bun run web:build` succeeds.
TEST COMMAND: rg -n "notes" web/content/docs/architecture/project-structure.mdx
EXPECTED RESULT: PASS — no matches.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.A6 — CHANGE A6 — web/content/docs/architecture/tech-stack.mdx — seven -> six (x2)

BEFORE (line ~12):
```mdx
| **Backend** | Tauri v2, Rust workspace with seven crates |
```
AFTER:
```mdx
| **Backend** | Tauri v2, Rust workspace with six crates |
```

BEFORE (line ~41):
```mdx
The Rust side is a Cargo workspace of seven crates, each with a single
```
AFTER:
```mdx
The Rust side is a Cargo workspace of six crates, each with a single
```

NO UNIT TEST — verified by: `rg -n "seven crates" web/content/docs/architecture/tech-stack.mdx` returns no matches.
TEST COMMAND: rg -n "seven crates" web/content/docs/architecture/tech-stack.mdx
EXPECTED RESULT: PASS — no matches.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.A7 — CHANGE A7 — web/content/docs/index.mdx + docs/procurement/README.md — "7 crates" -> "6 crates"

BEFORE (web/content/docs/index.mdx, line ~86):
```mdx
    title="Rust workspace, 7 crates"
```
AFTER:
```mdx
    title="Rust workspace, 6 crates"
```

BEFORE (docs/procurement/README.md, line ~26):
```md
- **Backend**: Rust workspace of 7 crates, Tauri v2
```
AFTER:
```md
- **Backend**: Rust workspace of 6 crates, Tauri v2
```

NO UNIT TEST — verified by: `rg -n "7 crates" web/content/docs/index.mdx docs/procurement/README.md` returns no matches; `bun run web:build` succeeds.
TEST COMMAND: rg -n "7 crates" web/content/docs/index.mdx docs/procurement/README.md
EXPECTED RESULT: PASS — no matches.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

#### Group B — Standardize IPC on `invokeTauri()`

````text
A.1.B1 — CHANGE B1 — src/lib/context-search.ts — invoke -> invokeTauri

BEFORE (line 2):
```ts
import { invoke } from "@tauri-apps/api/core"
```
AFTER:
```ts
import { invokeTauri } from "@/lib/tauri-runtime"
```

BEFORE (line 44-46):
```ts
  const rows = await invoke<VerseSearchRow[]>("get_translation_verses_for_search", {
    translationId,
  })
```
AFTER:
```ts
  const rows = await invokeTauri<VerseSearchRow[]>("get_translation_verses_for_search", {
    translationId,
  })
```

TARGETED TEST: existing suite, updated by B2.
TEST COMMAND: bunx vitest run src/lib/context-search.test.ts
EXPECTED RESULT: PASS (after B2 applied — B2 Depends on B1).
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.B2 — CHANGE B2 — src/lib/context-search.test.ts — mock invokeTauri instead of core invoke

BEFORE (line 7):
```ts
import { invoke } from "@tauri-apps/api/core"
```
AFTER:
```ts
import { invokeTauri } from "@/lib/tauri-runtime"
```

BEFORE (line 10-14):
```ts
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}))

const mockInvoke = vi.mocked(invoke)
```
AFTER:
```ts
vi.mock("@/lib/tauri-runtime", () => ({
  invokeTauri: vi.fn(),
}))

const mockInvoke = vi.mocked(invokeTauri)
```

NOTE: `mockInvoke` keeps its name so the rest of the file's assertions (lines 19, 50-52, 69, 88, 125) are unchanged.

TARGETED TEST: run the file; this is the red->green proof for the B1+B2 pair.
TEST COMMAND: bunx vitest run src/lib/context-search.test.ts
EXPECTED RESULT: PASS — all existing cases pass against the new mock.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.B3 — CHANGE B3 — src/lib/theme-designer-files.ts — invoke -> invokeTauri (3 sites)

BEFORE (line 2):
```ts
import { invoke } from "@tauri-apps/api/core"
```
AFTER:
```ts
import { invokeTauri } from "@/lib/tauri-runtime"
```

BEFORE (line 22): `  return await invoke<string>("read_image_as_data_url", { path })`
AFTER:  `  return await invokeTauri<string>("read_image_as_data_url", { path })`

BEFORE (line 34): `  await invoke("export_theme_to_path", { path, theme })`
AFTER:  `  await invokeTauri("export_theme_to_path", { path, theme })`

BEFORE (line 50): `  const parsed = (await invoke("import_theme_from_path", { path })) as BroadcastTheme`
AFTER:  `  const parsed = (await invokeTauri("import_theme_from_path", { path })) as BroadcastTheme`

NO UNIT TEST — verified by: tsc --noEmit (0 errors) + lint. No existing test for this module.
TEST COMMAND: bun run typecheck
EXPECTED RESULT: PASS — 0 errors.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.B4 — CHANGE B4 — src/hooks/use-assets.ts — invoke -> invokeTauri

BEFORE (line 2):
```ts
import { invoke } from "@tauri-apps/api/core"
```
AFTER:
```ts
import { invokeTauri } from "@/lib/tauri-runtime"
```

BEFORE (line 25): `      setStatus(await invoke<AssetStatus>("asset_status"))`
AFTER:  `      setStatus(await invokeTauri<AssetStatus>("asset_status"))`

NOTE: the catch block is changed in D1 (Depends: B4).

NO UNIT TEST — verified by: tsc --noEmit. (Behavior unchanged; D1 adds the toast.)
TEST COMMAND: bun run typecheck
EXPECTED RESULT: PASS — 0 errors.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.B5 — CHANGE B5 — src/hooks/use-transcription.ts — invoke -> invokeTauri (2 sites)

BEFORE (line 2):
```ts
import { invoke } from "@tauri-apps/api/core"
```
AFTER:
```ts
import { invokeTauri } from "@/lib/tauri-runtime"
```

BEFORE (line 53): `      await invoke("start_transcription", {`
AFTER:  `      await invokeTauri("start_transcription", {`

BEFORE (line 72): `      await invoke("stop_transcription")`
AFTER:  `      await invokeTauri("stop_transcription")`

TARGETED TEST: existing hook test.
TEST COMMAND: bunx vitest run src/hooks/use-transcription.test.ts
EXPECTED RESULT: PASS.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.B6 — CHANGE B6 — src/hooks/use-broadcast-output-runtime.ts — invoke -> invokeTauri (2 sites)

BEFORE (line 2):
```ts
import { invoke } from "@tauri-apps/api/core"
```
AFTER:
```ts
import { invokeTauri } from "@/lib/tauri-runtime"
```

BEFORE (line 172): `      await invoke("push_ndi_frame", { request })`
AFTER:  `      await invokeTauri("push_ndi_frame", { request })`

BEFORE (line 264-267):
```ts
    void invoke<{ active: boolean; width: number; height: number; fps: number } | null>(
      "get_ndi_status",
      { outputId },
    )
```
AFTER:
```ts
    void invokeTauri<{ active: boolean; width: number; height: number; fps: number } | null>(
      "get_ndi_status",
      { outputId },
    )
```

NOTE: `getCurrentWebviewWindow().listen/emitTo` calls in this file are event APIs — OUT OF SCOPE, unchanged.

NO UNIT TEST — verified by: tsc --noEmit + the E2E spec in CP-04 exercises this window.
TEST COMMAND: bun run typecheck
EXPECTED RESULT: PASS — 0 errors.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.B7 — CHANGE B7 — src/components/layout/operator-status-actions.tsx — invoke -> invokeTauri

BEFORE (line 1):
```tsx
import { invoke } from "@tauri-apps/api/core"
```
AFTER:
```tsx
import { invokeTauri } from "@/lib/tauri-runtime"
```

BEFORE (line 60-62):
```tsx
    invoke("stop_reading_mode").catch((e) =>
      console.error("[operator-strip] stop reading mode failed", e)
    )
```
AFTER:
```tsx
    invokeTauri("stop_reading_mode").catch((e) =>
      console.error("[operator-strip] stop reading mode failed", e)
    )
```

TARGETED TEST: existing strip test.
TEST COMMAND: bunx vitest run src/components/layout/operator-status-strip.test.tsx
EXPECTED RESULT: PASS.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.B8 — CHANGE B8 — src/components/panels/search-panel.tsx — invoke -> invokeTauri (4 sites)

BEFORE (line 10):
```tsx
import { invoke } from "@tauri-apps/api/core"
```
AFTER:
```tsx
import { invokeTauri } from "@/lib/tauri-runtime"
```

BEFORE (line 307): `    const hybridResultsPromise = invoke<SemanticSearchResult[]>(`
AFTER:  `    const hybridResultsPromise = invokeTauri<SemanticSearchResult[]>(`

BEFORE (line 397): `        invoke<Verse[]>("get_chapter", {`
AFTER:  `        invokeTauri<Verse[]>("get_chapter", {`

BEFORE (line 579): `                  await invoke("set_active_translation", { translationId: id })`
AFTER:  `                  await invokeTauri("set_active_translation", { translationId: id })`

BEFORE (line 609): `                    await invoke("set_active_translation", { translationId: id })`
AFTER:  `                    await invokeTauri("set_active_translation", { translationId: id })`

NO UNIT TEST — verified by: tsc --noEmit + lint. (Component has no direct unit test; covered by typecheck.)
TEST COMMAND: bun run typecheck
EXPECTED RESULT: PASS — 0 errors.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.B9 — CHANGE B9 — src/components/settings-dialog.tsx — invoke -> invokeTauri (16 sites)

BEFORE (line 10):
```tsx
import { invoke } from "@tauri-apps/api/core"
```
AFTER:
```tsx
import { invokeTauri } from "@/lib/tauri-runtime"
```

Replace `invoke(` with `invokeTauri(` at each of these call sites (verbatim tokens, no other change):
  l131 `const result = await invoke<DeviceInfo[]>("get_audio_devices")`
  l285 `await invoke("set_deepgram_api_key", { apiKey: keyValue })`
  l286 `const hasKey = await invoke<boolean>("has_deepgram_api_key")`
  l304 `await invoke("clear_deepgram_api_key")`
  l724 `invoke<TranslationInfo[]>("list_translations"),`
  l725 `invoke<number>("get_active_translation"),`
  l741 `await invoke("set_active_translation", { translationId: id })`
  l844 `const osc = await invoke<RemoteStatus>("get_osc_status")`
  l851 `const http = await invoke<RemoteStatus>("get_http_status")`
  l858 `const hasToken = await invoke<boolean>("has_remote_http_token")`
  l911 `await invoke("stop_osc")`
  l916 `const boundPort = await invoke<number>("start_osc", { port })`
  l928 `await invoke("stop_http")`
  l933 `const boundPort = await invoke<number>("start_http", { port })`
  l949 `const token = await invoke<string>("rotate_remote_http_token")`
  (and the second `set_active_translation`/list pair if present in the same blocks)

DO NOT CHANGE: the dynamic `const { listen } = await import("@tauri-apps/api/event")` at l872 and its `listen(...)` calls — event API, out of scope.

VERIFICATION GUARD: after applying, `rg -n "invoke\(|@tauri-apps/api/core" src/components/settings-dialog.tsx` must return zero matches.

NO UNIT TEST — verified by: tsc --noEmit + lint + the rg guard above. Large file; rename-only.
TEST COMMAND: bun run typecheck && rg -n "from \"@tauri-apps/api/core\"" src/components/settings-dialog.tsx
EXPECTED RESULT: PASS — 0 type errors; rg prints nothing.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.B10 — CHANGE B10 — src/components/broadcast/broadcast-settings.tsx — invoke -> invokeTauri (17 sites)

BEFORE (line 2):
```tsx
import { invoke } from "@tauri-apps/api/core"
```
AFTER:
```tsx
import { invokeTauri } from "@/lib/tauri-runtime"
```

KEEP UNCHANGED (line 3): `import { emitTo, listen } from "@tauri-apps/api/event"` — event API, out of scope.

Replace `invoke(` with `invokeTauri(` at every command call site in this file:
  list_monitors (l206), open_broadcast_window (l311, l412), close_broadcast_window (l309, l342, l375, l441, l475), ensure_broadcast_window (l344, l445), stop_ndi (l337, l383, l437, l478), start_ndi (l351, l451).
Preserve any trailing `.catch(() => {})` exactly as-is in this change (D3 handles those).

VERIFICATION GUARD: `rg -n "[^a-zA-Z]invoke\(|from \"@tauri-apps/api/core\"" src/components/broadcast/broadcast-settings.tsx` returns zero matches; `emitTo`/`listen` still present in git diff context (unchanged).

NO UNIT TEST — verified by: tsc --noEmit + lint + rg guard. Covered indirectly by broadcast-settings-wiring.test.ts.
TEST COMMAND: bun run typecheck && bunx vitest run src/components/broadcast/broadcast-settings-wiring.test.ts
EXPECTED RESULT: PASS — 0 type errors; wiring test green.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

#### Group C — Logging safety

````text
A.1.C1 — CHANGE C1 — src-tauri/src/commands/stt.rs — gate transcript logging to debug builds

BEFORE (line 60-67):
```rust
fn transcript_logging_enabled() -> bool {
    matches!(
        std::env::var("SABBATHCUE_DEBUG_TRANSCRIPTS")
            .unwrap_or_default()
            .trim(),
        "1" | "true" | "TRUE" | "yes" | "YES"
    )
}
```
AFTER:
```rust
/// Pure policy: transcript text may be logged ONLY in debug builds AND when the
/// operator explicitly opts in via SABBATHCUE_DEBUG_TRANSCRIPTS. Release builds
/// can never log spoken content, regardless of the env var.
fn transcript_logging_decision(is_debug_build: bool, env_value: &str) -> bool {
    is_debug_build
        && matches!(env_value.trim(), "1" | "true" | "TRUE" | "yes" | "YES")
}

fn transcript_logging_enabled() -> bool {
    transcript_logging_decision(
        cfg!(debug_assertions),
        &std::env::var("SABBATHCUE_DEBUG_TRANSCRIPTS").unwrap_or_default(),
    )
}
```

TARGETED TEST (add near the other tests in this file, or in a new module at EOF):
```rust
#[cfg(test)]
mod transcript_logging_tests {
    use super::transcript_logging_decision;

    #[test]
    fn release_build_never_logs_even_with_optin() {
        assert!(!transcript_logging_decision(false, "1"));
        assert!(!transcript_logging_decision(false, "true"));
        assert!(!transcript_logging_decision(false, "YES"));
    }

    #[test]
    fn debug_build_logs_only_with_optin() {
        assert!(transcript_logging_decision(true, "1"));
        assert!(transcript_logging_decision(true, " YES "));
        assert!(!transcript_logging_decision(true, ""));
        assert!(!transcript_logging_decision(true, "0"));
        assert!(!transcript_logging_decision(true, "off"));
    }
}
```
TEST COMMAND: cd src-tauri && cargo test transcript_logging
EXPECTED RESULT: PASS — both cases. (red→green: the pure fn + tests are new.)
NOTE: all existing call sites call `transcript_logging_enabled()` unchanged; only its body and the new helper change.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.C2 — CHANGE C2 — src-tauri/crates/stt/src/deepgram.rs — redact Deepgram URL query in logs

BEFORE (line 67, inside build_url):
```rust
        log::info!("Deepgram WebSocket URL: {}", url.as_str());
```
AFTER:
```rust
        log::info!("Deepgram WebSocket endpoint: {}", redact_ws_url_query(&url));
```

ALSO ADD (a free function near build_url, module scope):
```rust
/// Return a log-safe form of a WebSocket URL: scheme://host/path with any query
/// string (which carries keyterms/keywords) replaced by `?<redacted>`.
fn redact_ws_url_query(url: &Url) -> String {
    let host = url.host_str().unwrap_or("");
    if url.query().is_some() {
        format!("{}://{}{}?<redacted>", url.scheme(), host, url.path())
    } else {
        format!("{}://{}{}", url.scheme(), host, url.path())
    }
}
```

TARGETED TEST (append a #[cfg(test)] mod in deepgram.rs):
```rust
#[cfg(test)]
mod deepgram_url_tests {
    use super::redact_ws_url_query;
    use url::Url;

    #[test]
    fn redacts_query_with_keyterms() {
        let url = Url::parse(
            "wss://api.deepgram.com/v1/listen?interim_results=true&keyterm=Yahweh&keyterm=Selah",
        )
        .unwrap();
        let redacted = redact_ws_url_query(&url);
        assert_eq!(redacted, "wss://api.deepgram.com/v1/listen?<redacted>");
        assert!(!redacted.contains("Yahweh"));
        assert!(!redacted.contains("keyterm"));
    }

    #[test]
    fn keeps_url_without_query_intact() {
        let url = Url::parse("wss://api.deepgram.com/v1/listen").unwrap();
        assert_eq!(
            redact_ws_url_query(&url),
            "wss://api.deepgram.com/v1/listen"
        );
    }
}
```
TEST COMMAND: cd src-tauri && cargo test -p rhema-stt deepgram_url_tests
EXPECTED RESULT: PASS — keyterms never appear in the redacted string.
NOTE: the existing `log::info!("Deepgram keyterm boosting: {} keyterms added", ...)` count log at l61-64 is non-sensitive (count only) and stays.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

#### Group D — Surface silent failures

````text
A.1.D1 — CHANGE D1 — src/hooks/use-assets.ts — toast on asset_status failure

BEFORE (line 1-2):
```ts
import { useCallback, useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
```
AFTER (note: line 2 already became invokeTauri in B4; D1 adds the sonner import):
```ts
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { invokeTauri } from "@/lib/tauri-runtime"
```

BEFORE (line 24-30, post-B4 state):
```ts
    try {
      setStatus(await invokeTauri<AssetStatus>("asset_status"))
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
```
AFTER:
```ts
    try {
      setStatus(await invokeTauri<AssetStatus>("asset_status"))
    } catch (error) {
      setStatus(null)
      toast.error("Could not check asset status", {
        id: "asset-status-error",
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
```

NOTE: stable `id` de-dupes repeated toasts across mount + manual refresh (R5). `invokeTauri` outside the desktop runtime throws a clear message, which becomes the toast description.

NO UNIT TEST — verified by: tsc --noEmit + lint; manual confirm toast shows when the command rejects.
TEST COMMAND: bun run typecheck && bun run lint
EXPECTED RESULT: PASS — 0 errors, clean lint.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.D2 — CHANGE D2 — src/stores/broadcast-store.ts — log instead of swallowing broadcast emit errors

BEFORE (line 154-166, emitDraftToBroadcast):
```ts
    void emitTo("broadcast", "broadcast:verse-update", {
      theme: state.draftTheme,
      item: state.isLive ? state.liveItem : null,
      opacity: state.opacity,
    }).catch(() => {})
  }
  if (id === state.altActiveThemeId) {
    void emitTo("broadcast-alt", "broadcast:verse-update", {
      theme: state.draftTheme,
      item: state.isLive ? state.liveItem : null,
      opacity: state.opacity,
    }).catch(() => {})
  }
```
AFTER:
```ts
    void emitTo("broadcast", "broadcast:verse-update", {
      theme: state.draftTheme,
      item: state.isLive ? state.liveItem : null,
      opacity: state.opacity,
    }).catch((error) =>
      console.warn("[broadcast-store] emit draft to 'broadcast' failed", error)
    )
  }
  if (id === state.altActiveThemeId) {
    void emitTo("broadcast-alt", "broadcast:verse-update", {
      theme: state.draftTheme,
      item: state.isLive ? state.liveItem : null,
      opacity: state.opacity,
    }).catch((error) =>
      console.warn("[broadcast-store] emit draft to 'broadcast-alt' failed", error)
    )
  }
```

BEFORE (line 286-290, syncBroadcastOutputFor):
```ts
    void emitTo(label, "broadcast:verse-update", {
      theme,
      item: s.isLive ? s.liveItem : null,
      opacity: s.opacity,
    }).catch(() => {})
```
AFTER:
```ts
    void emitTo(label, "broadcast:verse-update", {
      theme,
      item: s.isLive ? s.liveItem : null,
      opacity: s.opacity,
    }).catch((error) =>
      console.warn(`[broadcast-store] sync emit to '${label}' failed`, error)
    )
```

RATIONALE: these emits target the projector webview the operator does not watch; per the review's accepted design, a `console.warn` (not a toast) is the right surface — but it must no longer be a silent `() => {}`.

NO UNIT TEST — verified by: tsc --noEmit + lint + `rg -n "catch\(\(\) => \{\}\)" src/stores/broadcast-store.ts` returns no matches.
TEST COMMAND: bun run typecheck && rg -n "catch\(\(\) => \{\}\)" src/stores/broadcast-store.ts
EXPECTED RESULT: PASS — 0 type errors; rg prints nothing.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.D3 — CHANGE D3 — src/components/broadcast/broadcast-settings.tsx — surface swallowed emit/invoke errors

GENERAL RULE: in this file, replace each empty `.catch(() => {})` attached to an `emitTo(...)` or NDI sync `invokeTauri(...)` with a logged handler. Use the existing operator-error surface if one is present in the component (e.g. a `toast`/`showBroadcastError` already imported); otherwise `console.warn` with a `[broadcast-settings] <context>` prefix.

BEFORE (representative — syncNdiConfigToOutput emit, ~l189-194):
```tsx
    void emitTo(`broadcast${outputId === "alt" ? "-alt" : ""}`, "broadcast:ndi-config", {
      config,
    }).catch(() => {})
```
AFTER:
```tsx
    void emitTo(`broadcast${outputId === "alt" ? "-alt" : ""}`, "broadcast:ndi-config", {
      config,
    }).catch((error) =>
      console.warn("[broadcast-settings] emit ndi-config failed", error)
    )
```

APPLY THE SAME TRANSFORM to the other empty catches in this file (post-start emits ~l357-360 and ~l455-460, and the alt-toggle sync emits ~l475 / ~l479), each with a context-specific message:
  - "[broadcast-settings] emit post-start sync (main) failed"
  - "[broadcast-settings] emit post-start sync (alt) failed"
  - "[broadcast-settings] alt-toggle sync failed"

VERIFICATION GUARD: `rg -n "catch\(\(\) => \{\}\)" src/components/broadcast/broadcast-settings.tsx` returns zero matches.

NO UNIT TEST — verified by: tsc --noEmit + lint + the rg guard.
TEST COMMAND: bun run typecheck && rg -n "catch\(\(\) => \{\}\)" src/components/broadcast/broadcast-settings.tsx
EXPECTED RESULT: PASS — 0 type errors; rg prints nothing.
NOTE: CP-03 STEP 2 re-reads exact line content; the `~lNNN` markers are approximate and must be matched against the file at apply time.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

#### Group E — Tests + CI

````text
A.1.E1 — CHANGE E1 — src-tauri/src/commands/validation.rs — unit tests for pure validators

BEFORE: (no test module exists; file ends at line 42 with the closing of valid_port)

AFTER — APPEND at EOF:
```rust

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounded_text_accepts_within_limit_and_rejects_over() {
        assert!(bounded_text("hello", "query", 10).is_ok());
        assert!(bounded_text("", "query", 0).is_ok());
        let err = bounded_text("toolong", "query", 3).unwrap_err();
        assert!(err.contains("query"));
        assert!(err.contains("Max is 3 bytes"));
    }

    #[test]
    fn bounded_limit_rejects_zero_and_caps_at_max() {
        assert!(bounded_limit(0).is_err());
        assert_eq!(bounded_limit(5).unwrap(), 5);
        assert_eq!(bounded_limit(MAX_SEARCH_LIMIT).unwrap(), MAX_SEARCH_LIMIT);
        assert_eq!(bounded_limit(MAX_SEARCH_LIMIT + 50).unwrap(), MAX_SEARCH_LIMIT);
    }

    #[test]
    fn bounded_optional_limit_uses_default_when_none() {
        assert_eq!(bounded_optional_limit(None, 15).unwrap(), 15);
        assert_eq!(bounded_optional_limit(Some(3), 15).unwrap(), 3);
        assert!(bounded_optional_limit(Some(0), 15).is_err());
    }

    #[test]
    fn valid_confidence_threshold_clamps_and_rejects_non_finite() {
        assert_eq!(valid_confidence_threshold(0.5).unwrap(), 0.5);
        assert_eq!(valid_confidence_threshold(-1.0).unwrap(), 0.0);
        assert_eq!(valid_confidence_threshold(2.0).unwrap(), 1.0);
        assert!(valid_confidence_threshold(f32::NAN).is_err());
        assert!(valid_confidence_threshold(f32::INFINITY).is_err());
    }

    #[test]
    fn valid_port_rejects_zero_and_passes_through() {
        assert!(valid_port(Some(0), 8080).is_err());
        assert_eq!(valid_port(Some(9000), 8080).unwrap(), 9000);
        assert_eq!(valid_port(None, 8080).unwrap(), 8080);
    }
}
```
TEST COMMAND: cd src-tauri && cargo test validation::tests
EXPECTED RESULT: PASS — 5 cases. (red→green: module is new.)
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.E2 — CHANGE E2 — src-tauri/crates/broadcast/src/ndi.rs — extract pure frame helpers + tests

PART 1 — ADD two free functions (module scope, e.g. just below the NdiError enum at ~line 133):
```rust
/// Validate that an incoming RGBA frame matches the active session dimensions and that
/// the buffer length is exactly width*height*4. Returns the expected byte length.
fn validate_frame_dimensions(
    width: u32,
    height: u32,
    rgba_len: usize,
    expected_width: u32,
    expected_height: u32,
) -> Result<usize, NdiError> {
    if width != expected_width || height != expected_height {
        return Err(NdiError::FrameDimensionsMismatch {
            expected_width,
            expected_height,
        });
    }
    let expected = (width * height * 4) as usize;
    if rgba_len != expected {
        return Err(NdiError::InvalidFrameBufferSize { width, height });
    }
    Ok(expected)
}

/// Convert `rgba` into the BGRA byte layout NDI expects, writing into `dst`
/// (which must be the same length as `rgba`). Alpha is forced to 255 for opaque mode.
fn convert_rgba_to_bgra_into(rgba: &[u8], dst: &mut [u8], alpha_mode: NdiAlphaMode) {
    for (idx, px) in rgba.chunks_exact(4).enumerate() {
        let offset = idx * 4;
        dst[offset] = px[2];
        dst[offset + 1] = px[1];
        dst[offset + 2] = px[0];
        dst[offset + 3] = match alpha_mode {
            NdiAlphaMode::NoneOpaque => 255,
            NdiAlphaMode::StraightAlpha | NdiAlphaMode::PremultipliedAlpha => px[3],
        };
    }
}
```

PART 2 — REPLACE the head of send_frame_rgba.
BEFORE (line 329-355):
```rust
        if width != self.info.width || height != self.info.height {
            return Err(NdiError::FrameDimensionsMismatch {
                expected_width: self.info.width,
                expected_height: self.info.height,
            });
        }

        let expected = (width * height * 4) as usize;
        if rgba_data.len() != expected {
            return Err(NdiError::InvalidFrameBufferSize { width, height });
        }

        if self.frame_buffer.len() != expected {
            self.frame_buffer.resize(expected, 0);
        }

        // Convert RGBA -> BGRA for NDIlib_FourCC_type_BGRA.
        for (idx, px) in rgba_data.chunks_exact(4).enumerate() {
            let offset = idx * 4;
            self.frame_buffer[offset] = px[2];
            self.frame_buffer[offset + 1] = px[1];
            self.frame_buffer[offset + 2] = px[0];
            self.frame_buffer[offset + 3] = match self.info.alpha_mode {
                NdiAlphaMode::NoneOpaque => 255,
                NdiAlphaMode::StraightAlpha | NdiAlphaMode::PremultipliedAlpha => px[3],
            };
        }
```
AFTER:
```rust
        let expected = validate_frame_dimensions(
            width,
            height,
            rgba_data.len(),
            self.info.width,
            self.info.height,
        )?;

        if self.frame_buffer.len() != expected {
            self.frame_buffer.resize(expected, 0);
        }

        // Convert RGBA -> BGRA for NDIlib_FourCC_type_BGRA.
        convert_rgba_to_bgra_into(rgba_data, &mut self.frame_buffer, self.info.alpha_mode);
```
The rest of send_frame_rgba (the `#[expect(...)]` frame construction and unsafe send) is UNCHANGED. This is behavior-preserving (R1).

PART 3 — APPEND a test module at EOF:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolution_dimensions_are_correct() {
        assert_eq!(NdiResolution::R720p.dimensions(), (1280, 720));
        assert_eq!(NdiResolution::R1080p.dimensions(), (1920, 1080));
        assert_eq!(NdiResolution::R4k.dimensions(), (3840, 2160));
    }

    #[test]
    fn frame_rate_fps_are_correct() {
        assert_eq!(NdiFrameRate::Fps24.fps(), 24);
        assert_eq!(NdiFrameRate::Fps30.fps(), 30);
        assert_eq!(NdiFrameRate::Fps60.fps(), 60);
    }

    #[test]
    fn ndi_error_display_messages() {
        assert_eq!(NdiError::EmptySourceName.to_string(), "NDI source name must not be empty");
        assert_eq!(
            NdiError::FrameDimensionsMismatch { expected_width: 1920, expected_height: 1080 }.to_string(),
            "frame dimensions do not match active NDI settings (1920x1080)"
        );
    }

    #[test]
    fn start_request_serde_round_trip() {
        let req = NdiStartRequest {
            source_name: "SabbathCue".to_string(),
            resolution: NdiResolution::R1080p,
            frame_rate: NdiFrameRate::Fps30,
            alpha_mode: NdiAlphaMode::StraightAlpha,
        };
        let json = serde_json::to_string(&req).unwrap();
        // camelCase rename is applied
        assert!(json.contains("\"sourceName\""));
        assert!(json.contains("\"frameRate\""));
        let back: NdiStartRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(back, req);
    }

    #[test]
    fn validate_frame_dimensions_enforces_size_and_shape() {
        // 2x1 RGBA = 8 bytes
        assert_eq!(validate_frame_dimensions(2, 1, 8, 2, 1).unwrap(), 8);
        assert!(matches!(
            validate_frame_dimensions(2, 1, 8, 4, 1),
            Err(NdiError::FrameDimensionsMismatch { expected_width: 4, expected_height: 1 })
        ));
        assert!(matches!(
            validate_frame_dimensions(2, 1, 7, 2, 1),
            Err(NdiError::InvalidFrameBufferSize { width: 2, height: 1 })
        ));
    }

    #[test]
    fn convert_rgba_to_bgra_swaps_channels_and_honors_alpha() {
        // one pixel: R=10 G=20 B=30 A=40
        let rgba = [10u8, 20, 30, 40];
        let mut dst = [0u8; 4];

        convert_rgba_to_bgra_into(&rgba, &mut dst, NdiAlphaMode::NoneOpaque);
        assert_eq!(dst, [30, 20, 10, 255]); // B,G,R, forced opaque

        convert_rgba_to_bgra_into(&rgba, &mut dst, NdiAlphaMode::StraightAlpha);
        assert_eq!(dst, [30, 20, 10, 40]);

        convert_rgba_to_bgra_into(&rgba, &mut dst, NdiAlphaMode::PremultipliedAlpha);
        assert_eq!(dst, [30, 20, 10, 40]);
    }
}
```
NOTE: this test module needs `serde_json` available to the broadcast crate's tests. If it is not already a dependency, add `serde_json = { workspace = true }` under `[dev-dependencies]` in `src-tauri/crates/broadcast/Cargo.toml` (dev-only; confirm at apply time and record in A.6 if added).

TEST COMMAND: cd src-tauri && cargo test -p rhema-broadcast ndi::tests
EXPECTED RESULT: PASS — 6 cases. (red→green: helpers + module are new; behavior identical.)
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

````text
A.1.E3 — CHANGE E3 — .github/workflows/desktop-ci.yml — add Playwright E2E to the frontend job

BEFORE (line 35-39):
```yaml
      - name: Build frontend
        run: bun run build

      - name: npm audit
        run: npm audit --audit-level=moderate
```
AFTER:
```yaml
      - name: Build frontend
        run: bun run build

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: E2E tests
        run: bun run test:e2e
        env:
          CI: "true"

      - name: npm audit
        run: npm audit --audit-level=moderate
```

NOTE: `playwright.config.ts` already sets `reuseExistingServer: !process.env.CI`, so `CI=true` forces a fresh `webServer` build in CI (R6). `test:e2e` is an existing package.json script.

NO UNIT TEST — verified by: a CI run on the branch shows the two new steps green. Locally: `bun run test:e2e` passes.
TEST COMMAND: bun run test:e2e
EXPECTED RESULT: PASS — Playwright spec(s) green locally; CI job green after push.
OPERATOR SIGN-OFF: [ NAME / DATE ]
````

---

### A.2 · Per-change test results (CP-03 log)

```text
[ one entry per change during execution: DIFF / COMPILER / TARGETED TEST / RESULT ]
```

### A.3 · Full suite test output (CP-04)

```text
[ paste Rust + Vitest + Playwright full output ]
```

### A.4 · Quality review log (CP-04.5)

```text
[ one entry per changed file across all five dimensions; FILE SCORE A-F ]
```

### A.5 · Errors encountered & resolutions

```text
[ error -> root cause -> fix + diff ]
```

### A.6 · Decisions & deviations

```text
[ deviation -> reason -> approver ]
```

---

## § 7 · HARD STOP RULES

| # | Rule |
| --- | --- |
| HS-1 | Never modify files outside §1.2 without written approval. |
| HS-2 | Never pass a checkpoint without its required proof. |
| HS-3 | "Complete" = all tests pass, 0 type errors, diff matches plan, proof exists. |
| HS-4 | No 4th attempt at the same fix without documenting the prior 3 and asking. |
| HS-5 | Appendix is append-only. |
| HS-6 | Confidence < ~90% -> halt and ask. |
| HS-7 | Never auto-resolve a git conflict. |
| HS-8 | Never apply CP-03 code that differs from an approved A.1 AFTER block. |

---

## PLAN COMPLETION SIGN-OFF

| Checkpoint | Status | Proof location |
| --- | --- | --- |
| CP-01 Read codebase | `[ ]` | §2 CP-01 proof |
| CP-02A Change index | `[ ]` | §2 CP-02 Phase A |
| CP-02B Code generation | `[ ]` | §6 A.1 |
| CP-02C Risks & sign-off | `[ ]` | §2 CP-02 sign-off |
| CP-03 Apply code | `[ ]` | §6 A.2 |
| CP-04 Regression sweep | `[ ]` | §6 A.3 |
| CP-04.5 Quality review | `[ ]` | §6 A.4 |
| CP-05 Final review | `[ ]` | §2 CP-05 proof |

**Quality verdict:** `[ ... ]`  ·  **Final git diff attached:** `[ YES/NO ]`  ·  **Operator final sign-off:** `[ NAME / DATE ]`  ·  **Definition of done verified (§1.5):** `[ YES/NO ]`

---

*Instance of Template v1.3 · Pre-generated human-approved code · Atomic change→test loop · Zero-hallucination policy enforced.*
