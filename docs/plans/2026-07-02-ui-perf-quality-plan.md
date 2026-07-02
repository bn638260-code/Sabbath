# CODING AGENT PLAN — UI, Performance & Quality Backlog
### Instance of CODING AGENT PLAN TEMPLATE v1.4 · Checkpoint-Based · Zero-Hallucination · Zero-Bloat

> This plan instantiates the v1.4 template. Sections §0, §3, §3A, §3B, §4, §5, §6, §7 of the
> template apply verbatim and are not duplicated here — the executing agent must follow them.
> This document fills in the plan-specific sections: metadata, §1 scope, and the CP-02 Phase A
> change index (pre-drafted for operator review; Phase B exact code is generated at CP-02 time,
> after CP-01 fresh file reads, per template rules).

---

## PLAN METADATA

| Field | Value |
|---|---|
| **Plan Name** | UI, Performance & Quality Backlog (post-review) |
| **Version** | v1.4 (template) / plan rev 1 |
| **Agent ID / Session** | 1eab6946-5882-4ef8-82e3-be6b0d97d5f9 (review session) |
| **Codebase / Repo** | rhema-main (SabbathCue) @ main (6d0fc4b) |
| **Language / Stack** | TypeScript + React 19 + Vite + Zustand · Rust (Tauri v2) |
| **Plan Author** | Claude (from 2026-07-02 codebase review) — pending operator sign-off |
| **Date Created** | 2026-07-02 |
| **Completion Target** | operator to set |

**Source findings:** codebase review of 2026-07-02 — bug-risk notes R1–R3, hygiene items R4–R6,
`drawBackground` complexity warning, performance items P1–P3 (NDI IPC, `willReadFrequently`,
image cache), UI items U4–U7 (transcript scroll, toast ids, reduced motion, canvas-remount
black frame), plus the operator request: **move the Start/Stop transcribing control from the
bottom of the transcript panel to the top.**

---

## § 1 · FULL SCOPE DEFINITION

### 1.1 What this plan accomplishes

```
Apply the accepted findings from the 2026-07-02 codebase review as a sequence of small,
individually-tested changes, grouped into five independent batches:

  BATCH A — Repo hygiene (no code behavior change):
    A1. Untrack the committed tmp/ scrape artifacts (77 files) and gitignore tmp/.
    A2. Move the ~14 root-level report/plan markdown files into docs/reports/.

  BATCH B — One-line hardening & polish:
    B1. use-transcription.ts stop(): match the "Transcription is not running" error with
        String(e).includes(...) instead of strict equality (R1).
    B2. Give the STT error toasts a stable id ("stt-status") so repeated provider errors
        replace instead of stack (U5).
    B3. Create the NDI readback 2D contexts with { willReadFrequently: true } (P2).

  BATCH C — Transcript panel UX:
    C1. Move the Start/Stop transcribing control from the bottom bar of the transcript
        panel to a bar directly beneath the PanelHeader (operator request). Visual
        placement only — handlers, labels, and states unchanged.
    C2. Stick-to-bottom auto-scroll: only auto-scroll when already within ~40px of the
        bottom; show a "Jump to latest" affordance when the user has scrolled up (U4).

  BATCH D — Broadcast output correctness & perf:
    D1. On broadcast-output effect re-run, redraw latestData.current (or reset
        lastRenderKeyRef) so a canvas remount can never leave the live output black
        until a *different* payload arrives (R2/U7). Test-first (red → green).
    D2. Cap the broadcast image cache (imageCacheRef) with simple oldest-entry eviction
        past ~20 entries (P3).

  BATCH E — Refactors & larger perf:
    E1. Move restartActiveTranscriptionIfNeeded + ProviderChangeHandler out of
        use-deepgram-key-settings.ts into a neutral module; fold the 3× repeated
        save/clear API-key pattern into one factory (R6).
    E2. Split drawBackground gradient/image cases into named helpers to clear the
        complexity-23 ESLint warning.
    E3. NDI frame IPC: replace the base64-JSON frame payload with Tauri v2 raw binary
        invoke bodies on both the TS and Rust sides (P1). Own branch; both sides land
        in one commit; manual NDI verification required in addition to unit tests.

  DEFERRED (needs operator decision before it enters scope):
    U6 prefers-reduced-motion support in the operator dashboard — scope of which
    animations to gate (kinetic thumbnails, pulse dots, canvas transitions) is a
    product decision. Not in this plan until the operator specifies.

  MUST NOT CHANGE:
    - Projector/live output rendering results (pixel behavior) except the D1 black-frame fix.
    - Detection, queue, presentation, and settings-persistence behavior.
    - Public Tauri command names other than the push_ndi_frame payload shape (E3).
    - R3 (confidence-threshold migration) is explicitly ACCEPTED AS-IS — do not "fix" it.
```

### 1.2 Files in scope — every file the agent is allowed to modify

```
BATCH A:
  .gitignore
  tmp/**                                        (git rm --cached only — files stay on disk)
  <root>/*.md report/plan files → docs/reports/ (git mv; list resolved at CP-01)

BATCH B:
  src/hooks/use-transcription.ts
  src/hooks/use-transcription.test.ts
  src/hooks/use-broadcast-output-runtime.ts
  src/lib/broadcast-output-ndi.ts
  src/lib/broadcast-output-ndi.test.ts

BATCH C:
  src/components/panels/transcript-panel.tsx
  src/components/panels/transcript-panel.test.tsx   (create if absent)

BATCH D:
  src/hooks/use-broadcast-output-runtime.ts
  src/hooks/use-broadcast-output-runtime.test.ts

BATCH E:
  src/hooks/use-deepgram-key-settings.ts
  src/hooks/use-gladia-key-settings.ts
  src/hooks/use-soniox-key-settings.ts
  src/lib/stt-key-settings.ts                       (new)
  src/lib/verse-draw.ts
  src/lib/broadcast-output-ndi.ts
  src/hooks/use-broadcast-output-runtime.ts
  src-tauri/src/commands/broadcast.rs
  src/types/** (only the NdiFrameRequest type)

Any file importing a moved/renamed symbol (resolved by CP-01 grep; append here at CP-01
with operator visibility — do not silently expand).
```

### 1.3 Files explicitly OUT of scope — must not be touched

```
src/stores/settings-store.ts            (R3 accepted as-is)
src/stores/detection-store.ts
src/lib/verse-detection-workflow.ts
src/components/ui/sidebar.tsx           (vendored shadcn)
src/data/**                             (hymnal/bible data)
src-tauri/** other than commands/broadcast.rs (and lib.rs only if E3 forces a signature re-registration)
package.json / Cargo.toml dependencies  (no new dependencies anywhere in this plan)
supabase/, web/, landing/, scripts/, sdk/, sidecars/
.env files, tauri.conf.json
```

### 1.4 Dependencies and external systems involved

```
- Tauri v2 IPC (invoke raw binary bodies) — E3 only. Verify against official Tauri v2 docs
  (tauri::ipc::Request / InvokeBody::Raw) and cite the URL per §5 before writing CP-02 code.
- NDI runtime (src-tauri NdiRuntime) — E3 changes the payload decode path only.
- sonner (toasts) — B2 uses the existing id option already used at use-transcription.ts:315.
- No new dependencies are permitted (HS-9).
```

### 1.5 Definition of done

```
Per batch (each batch is independently shippable, in order A → E):
  - All CP-02 changes for the batch applied with matching diffs (A.2 entries complete).
  - npx vitest --run: 796+ passing, zero new failures; new tests for C2, D1, D2, E1, E3.
  - npx tsc --noEmit: 0 errors.  npx eslint .: 0 errors, and after E2 zero warnings.
  - cargo check + cargo clippy --workspace: clean (batches touching src-tauri).
  - No files outside §1.2 modified (git status verified).

Plan-level:
  - Transcript panel shows the Start/Stop control directly under the panel header; no
    control bar remains at the bottom (C1) — verified by running the app (/verify).
  - Operator can scroll up during live transcription without being yanked down (C2).
  - Broadcast output re-renders the current payload after a canvas remount (D1 test red→green).
  - push_ndi_frame carries raw bytes, not base64 (E3), verified by a live NDI session.
  - CP-06 Change Report written to §6 A.7.
  - R3 untouched; tmp/ untracked; root reports relocated.
```

---

## § 2 · CHECKPOINT EXECUTION PLAN

> Execute per template v1.4. Statuses below are the plan's starting state. **Each batch runs
> its own CP-01 → CP-06 cycle** (small cycles beat one giant cycle; batches are independent).
> Batch E3 additionally requires its own branch and a manual NDI verification step (CP-07).

### ◦ CP-01 · Read and understand the full codebase context — `PENDING`
Per batch: read every §1.2 file for that batch in full; grep every symbol to be changed
(`restartActiveTranscriptionIfNeeded`, `ProviderChangeHandler`, `createNdiFrameRequest`,
`uint8ToBase64`, `NdiFrameRequest`, `rgba_base64`, `drawBackground`, `imageCacheRef`);
paste file map + grep output + data-flow summary.

### ◦ CP-02 · Generate the complete implementation — `PENDING (Phase A pre-drafted below)`

#### Phase A — Change index (pre-drafted for operator review)

```
CHANGE 1  [BATCH A]
  File:     .gitignore + git index
  Location: repo root
  Type:     DELETE (from index only) + MODIFY (.gitignore)
  Summary:  git rm -r --cached tmp/; add "tmp/" to .gitignore. Working-tree files remain.
  Depends:  none
  Test:     NO UNIT TEST — verified by: git ls-files | grep -c "^tmp/" == 0 and clean build.

CHANGE 2  [BATCH A]
  File:     ~14 root report/plan .md files → docs/reports/
  Location: repo root (exact list captured at CP-01: DEBUGGING_REPORT.md,
            CODE_QUALITY_REPORT.md, PRODUCTION_*.md, *_TEST_REPORT.md, *_PLAN.md,
            WHY_THESE_CHANGES.md, code-logic-review-fix-report.md,
            production-safe-*.md — README.md and LICENSE stay)
  Type:     RENAME (git mv)
  Summary:  Relocate stale root reports into docs/reports/ to unclutter the root.
  Depends:  none
  Test:     NO UNIT TEST — verified by: git status (renames only) + full suite green
            (guards against any test reading these paths).

CHANGE 3  [BATCH B]
  File:     src/hooks/use-transcription.ts
  Location: transcriptionActions.stop() — the NOT_RUNNING_ERROR comparison (line ~191)
  Type:     MODIFY
  Summary:  Replace String(e) !== NOT_RUNNING_ERROR with !String(e).includes(NOT_RUNNING_ERROR)
            so wrapped/reworded backend messages don't produce a spurious error toast.
  Depends:  none
  Test:     New unit test in use-transcription.test.ts: stop() with a wrapped
            "…Transcription is not running…" rejection shows no toast; unrelated error does.

CHANGE 4  [BATCH B]
  File:     src/hooks/use-transcription.ts
  Location: toast.error calls at start() (~line 180) and stt_error handler (~line 301)
  Type:     MODIFY
  Summary:  Add { id: "stt-status" } so repeated STT failures replace one toast instead
            of stacking (mirrors existing "audio-source-status" pattern at line 315).
  Depends:  none
  Test:     Extend existing toast assertions in use-transcription.test.ts to check the id.

CHANGE 5  [BATCH B]
  File:     src/lib/broadcast-output-ndi.ts + src/hooks/use-broadcast-output-runtime.ts
  Location: resolveNdiFrameSource scratch getContext("2d") (~ndi.ts:55) and the readback
            getContext("2d") in pushNdiFrame (~runtime.ts:317)
  Type:     MODIFY
  Summary:  Create these contexts with { willReadFrequently: true } to avoid per-frame
            GPU→CPU sync on getImageData. Rendering contexts elsewhere unchanged.
  Depends:  none
  Test:     Existing broadcast-output-ndi.test.ts still green; add an assertion that the
            scratch context is requested with willReadFrequently where mockable.

CHANGE 6  [BATCH C — operator request]
  File:     src/components/panels/transcript-panel.tsx
  Location: "Bottom control" block (lines ~230-248) and the area directly after
            </PanelHeader> (line ~154)
  Type:     MODIFY (move JSX block)
  Summary:  Move the Start/Stop transcribing control bar from the bottom of the panel to
            directly beneath the PanelHeader. Same buttons, handlers, icons, labels;
            border-t styling becomes border-b. Nothing else in the panel changes.
  Depends:  none
  Test:     transcript-panel test: control renders before the scroll region in DOM order
            and no bottom bar exists; Start/Stop click behavior unchanged.

CHANGE 7  [BATCH C]
  File:     src/components/panels/transcript-panel.tsx
  Location: auto-scroll effects (lines ~66-70 and ~107-111) + scroll container (~156)
  Type:     MODIFY
  Summary:  Stick-to-bottom: track whether the user is within ~40px of the bottom
            (scroll listener + ref); auto-scroll only when stuck; render a small
            "Jump to latest" button (appears when unstuck) that scrolls to bottom
            and re-sticks. Applies to both the segment effect and LivePartialLine.
  Depends:  CHANGE 6 (same file — apply in order)
  Test:     Unit test with a scrollable fake: (a) at bottom + new segment → scrolled;
            (b) scrolled up + new segment → position preserved; (c) jump button re-sticks.

CHANGE 8  [BATCH D]
  File:     src/hooks/use-broadcast-output-runtime.ts
  Location: main useEffect body (lines ~527-558)
  Type:     MODIFY
  Summary:  On effect (re)run: if latestData.current exists, redraw it instead of only
            filling black, and reset lastRenderKeyRef.current = null so the next payload
            is never mistaken for a duplicate on a fresh canvas. Fixes the possible
            stuck-black output after canvas remount (review R2/U7).
  Depends:  none
  Test:     RED→GREEN in use-broadcast-output-runtime.test.ts: render payload → remount
            canvas → assert canvas repainted (or duplicate payload now applies).
            Test MUST fail on current code first (§3A red-green rule).

CHANGE 9  [BATCH D]
  File:     src/hooks/use-broadcast-output-runtime.ts
  Location: imageCacheRef + preloadBackgroundImage/preloadSlideImage (~129, 270-307)
  Type:     MODIFY
  Summary:  Bound the image cache: on insert past 20 entries, delete the oldest (Map
            preserves insertion order). Extract one small shared cacheImage helper used
            by both preload functions (they are near-duplicates today).
  Depends:  CHANGE 8 (same file)
  Test:     Unit test: inserting 21 URLs evicts the first; cached URLs are reused.

CHANGE 10 [BATCH E]
  File:     src/lib/stt-key-settings.ts (new) + use-deepgram/gladia/soniox-key-settings.ts
  Location: restartActiveTranscriptionIfNeeded, ProviderChangeHandler, save/clear pattern
  Type:     ADD + MODIFY
  Summary:  Move the shared restart helper + type to the neutral module; add
            createProviderKeyActions(provider, commands) factory replacing the three
            copy-pasted save/clear implementations. Re-export from old paths is NOT
            kept — all imports updated (CP-01 grep drives the list).
  Depends:  none
  Test:     Existing key-settings hook tests must pass unchanged; add factory unit tests
            (save success / save-not-persisted / clear failure paths per provider).

CHANGE 11 [BATCH E]
  File:     src/lib/verse-draw.ts
  Location: drawBackground (line ~74, complexity 23)
  Type:     MODIFY
  Summary:  Extract drawGradientBackground(ctx, bg, w, h) and drawImageBackground(ctx,
            bg, w, h, imageCache) as module-private helpers; drawBackground becomes a
            dispatcher. Pixel behavior identical.
  Depends:  none
  Test:     Existing verse-renderer/kinetic tests green; eslint complexity warning gone
            (npx eslint src/lib/verse-draw.ts → 0 problems).

CHANGE 12 [BATCH E — own branch, own PR]
  File:     src/lib/broadcast-output-ndi.ts, src/hooks/use-broadcast-output-runtime.ts,
            src/types (NdiFrameRequest), src-tauri/src/commands/broadcast.rs
  Location: createNdiFrameRequest/uint8ToBase64 (TS) and push_ndi_frame/
            decode_ndi_frame_base64 (Rust)
  Type:     MODIFY (both sides atomically)
  Summary:  Replace the base64 JSON frame payload with a Tauri v2 raw binary invoke body:
            frontend sends the RGBA Uint8Array directly with outputId/width/height as
            headers or a small side-channel arg; Rust command takes tauri::ipc::Request
            and reads InvokeBody::Raw. Delete uint8ToBase64 + decode path. Exact API
            shape confirmed against official Tauri v2 docs at CP-02 (cite URL, §5 H.4).
  Depends:  none (but lands after E1/E2 to keep the branch conflict-free)
  Test:     TS: createNdiFrameRequest replacement unit test (byte length = w*h*4 passes,
            mismatch rejected). Rust: #[cfg(test)] for the new payload validation.
            CP-07 manual verification: live NDI session pushes frames end-to-end.
```

#### Phase B — `PENDING` (generated at execution time, after CP-01 fresh reads; BEFORE blocks
must be verbatim from the file as read in that session — do not copy from this plan.)

#### Phase C — Risks & unknowns (pre-drafted)

```
RISKS & UNKNOWNS:
  - CHANGE 8: the effect's dep array includes callbacks; redrawing on every re-run could
    double-draw during transitions. Detection: the new remount test + existing transition
    tests. Mitigation: redraw only when transitionFrameRef is null.
  - CHANGE 7: jsdom does not do real layout; the ~40px stick threshold logic must be
    testable with mocked scroll metrics. If unmockable, fall back to a pure helper
    (isNearBottom(scrollTop, scrollHeight, clientHeight)) unit-tested in isolation.
  - CHANGE 12: exact Tauri v2 raw-body API must be confirmed from docs before Phase B
    (tripwire H.4). If raw bodies prove unsupported for this command shape, STOP and
    report — fallback option (ArrayBuffer arg serialization) needs operator approval.
  - CHANGE 12 perf claim must be verified, not assumed: capture before/after CPU of the
    broadcast window during a 15fps kinetic NDI push (detection-profiler or Task Manager),
    logged in A.7.
  - CHANGE 2: some scripts/tests may reference root report paths. Detection: full-repo
    grep for each filename at CP-01 before moving.

TESTS THAT MAY BREAK:
  - use-broadcast-output-runtime.test.ts (CHANGES 8/9) — will be extended, not weakened.
  - broadcast-output-ndi.test.ts (CHANGES 5/12) — uint8ToBase64 tests are DELETED with
    the function in CHANGE 12 (behavior removed, not silenced) — documented in A.6.
  - Key-settings hook tests (CHANGE 10) — import paths updated with the move.

PRE-EXISTING FAILURES: none — baseline is 109 files / 796 passed / 1 skipped (2026-07-02).
```

### ◦ CP-03 · Apply pre-approved code — `PENDING`
Atomic loop per change, in index order, respecting Depends. One change → diff → typecheck
→ targeted test → log in A.2 → next.

### ◦ CP-04 · Full regression sweep — `PENDING`
Per batch: `npx vitest --run`, `npx tsc --noEmit`, `npx eslint .`; batches touching
src-tauri also `cargo check` + `cargo clippy --workspace`. Zero new failures vs baseline.

### ◦ CP-04.5 · Code quality review — `PENDING`
All six dimensions per changed file, logged in A.4. Dimension 6 watch items: CHANGE 9's
helper extraction and CHANGE 10's factory must not grow beyond what the three call sites
need (no speculative provider registry).

### ◦ CP-05 · Final review — `PENDING`
Full `git diff main` read line-by-line per batch; confirm scope; per-file summaries.

### ◦ CP-06 · Change report — `PENDING`
Written into §6 A.7 per template structure. Must include the measured NDI CPU result for
CHANGE 12 and a screenshot/verification note for CHANGE 6 (button at top).

### ◦ CP-07 · Manual NDI + UI verification (custom) — `PENDING`
1. Run the app; start a broadcast output with NDI active; confirm frames arrive
   (receiver or get_ndi_status) for ≥60s including a kinetic theme. (CHANGE 12)
2. Open the transcript panel: Start/Stop control is at the top under the header;
   start transcription; scroll up mid-stream; confirm no yank + "Jump to latest"
   works. (CHANGES 6/7)
Proof: pasted logs/status output + a written observation record in A.7.

---

## OPERATOR DECISIONS REQUIRED BEFORE CP-02 SIGN-OFF

1. **CHANGE 6 placement:** control bar directly beneath the header (plan default), or
   inside the PanelHeader row itself (next to the Dump button / level meter)?
2. **CHANGE 2 file list:** confirm which root .md files are historical reports (move) vs
   still-active plans (keep at root or move to docs/plans/).
3. **U6 (prefers-reduced-motion):** in or out of a future plan, and which surfaces.
4. **Batch E3 branch name** and whether it should wait for a release window (payload
   shape change to push_ndi_frame).

---

## PLAN COMPLETION SIGN-OFF

| Checkpoint | Status | Proof location |
|---|---|---|
| CP-01 Read codebase (per batch) | `[ ]` | §2 CP-01 proof block |
| CP-02A Change index | `[x] drafted — awaiting operator review` | this file, Phase A |
| CP-02B Code generation | `[ ]` | §6 A.1 |
| CP-02C Risks & operator sign-off | `[ ]` | §2 CP-02 sign-off block |
| CP-03 Apply pre-approved code | `[ ]` | §6 A.2 |
| CP-04 Full regression sweep | `[ ]` | §6 A.3 |
| CP-04.5 Code quality review | `[ ]` | §6 A.4 |
| CP-05 Final review | `[ ]` | §2 CP-05 proof block |
| CP-06 Change report | `[ ]` | §6 A.7 |
| CP-07 Manual NDI + UI verification | `[ ]` | §2 CP-07 proof block |

**Human operator sign-off:** `[ NAME ]` · `[ DATE ]`
