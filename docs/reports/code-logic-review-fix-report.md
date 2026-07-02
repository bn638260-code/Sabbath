# Code Logic Review — Fix Report & Numbered Task List

> Companion to [`code-logic-review-findings.md`](./code-logic-review-findings.md).  
> Lists everything that still needs fixing, who can do it, and numbered tasks you can assign or track.

**Date:** Tuesday, Jun 9, 2026  
**Branch:** `main` (no pending diff)  
**Open findings:** 12 (F-01 through F-12)

---

## How to read this document

| Label | Meaning |
| --- | --- |
| **🤖 Agent** | Cursor agent can implement in code + automated tests without hardware or product decisions |
| **👤 You** | Requires you — manual QA, product/UX decision, or process discipline the agent cannot enforce |
| **🤖+👤** | Agent implements; you must run manual verification before calling it done |
| **✅ Done** | Already fixed on `main`; no task needed |

**Task IDs:** `T-01` … `T-24` (action items). Finding IDs `F-01` … `F-12` map to the findings doc.

---

## Summary

| Category | Count |
| --- | --- |
| ✅ Already fixed (no task) | 8 items from prior production-safe review |
| 🤖 Agent can fix fully | 14 tasks |
| 🤖+👤 Agent implements, you verify | 4 tasks |
| 👤 You only | 6 tasks |
| **Total open work** | **24 numbered tasks** |

**Recommended execution order:** T-01 → T-02 → T-03 → T-04 → T-05 → T-06, then P2/P3 tasks, then manual QA (T-21–T-24).

---

## ✅ Already fixed — no action required

These were flagged in earlier reviews but are **resolved on current `main`**:

| # | Item | Evidence |
| --- | --- | --- |
| — | Dead `rhema-notes` crate | `src-tauri/crates/notes/` removed |
| — | Inconsistent IPC (`invoke` bypass) | All commands use `invokeTauri` |
| — | Transcript logging in release builds | `stt/utils.rs` `transcript_logging_decision` |
| — | Deepgram URL keyterm leak in logs | `deepgram.rs` redaction + tests |
| — | `asset_status` silent failure | `use-assets.ts` toast on error |
| — | `validation.rs` untested | Unit tests in `validation.rs` |
| — | NDI crate zero tests | Tests in `broadcast/src/ndi.rs` |
| — | E2E not gated in CI | `desktop-ci.yml` Playwright step |

---

## 🤖 Agent-can-fix tasks (code + unit tests)

These are fully in scope for a coding agent session. No new product decisions required beyond what is described.

---

### T-01 — Surface NDI frame push failures to the operator

| Field | Value |
| --- | --- |
| **Finding** | F-12 |
| **Severity** | High |
| **Owner** | 🤖 Agent |
| **Problem** | `push_ndi_frame` errors only call `warnNdiPushFailure` → `console.warn`. OBS shows a frozen frame; operator sees “NDI active” with no alert. |
| **Fix** | Add operator-visible feedback (Sonner toast with dedupe `id`, or persistent status in operator strip). Rate-limit repeats (e.g. once per 30s) so a broken NDI loop does not spam. |
| **Files** | `src/hooks/use-broadcast-output-runtime.ts`, `src/lib/broadcast-output-ndi.ts` (optional: shared helper), tests in `src/lib/broadcast-output-ndi.test.ts` |
| **Acceptance** | Unit test: `warnNdiPushFailure` path (or injected notifier) is invoked on failure; manual check: toast appears when push fails. |
| **Effort** | Small (~1–2 hours) |

---

### T-02 — Surface broadcast sync (`emitTo`) failures to the operator

| Field | Value |
| --- | --- |
| **Finding** | F-11 |
| **Severity** | High |
| **Owner** | 🤖 Agent |
| **Problem** | `syncBroadcastOutputFor` and draft emits use `.catch(console.warn)` only. Projector can show stale content silently. |
| **Fix** | Toast or operator status line on emit failure; include `outputId` / window label in message. Dedupe rapid failures. |
| **Files** | `src/stores/broadcast-store.ts`, `src/stores/broadcast-store.test.ts` (mock `emitTo`, assert notifier called) |
| **Acceptance** | Test asserts user-visible notifier on simulated `emitTo` rejection. |
| **Effort** | Small (~1–2 hours) |

---

### T-03 — Fix broadcast `enabled` toggle state desync

| Field | Value |
| --- | --- |
| **Finding** | F-05 |
| **Severity** | High |
| **Owner** | 🤖 Agent |
| **Problem** | `enabled` is local `useState(false)`; resets on every dialog open; set to `false` before async teardown finishes. |
| **Fix** | (1) On dialog open, derive initial `enabled` from `reconcileBroadcastPreviewState(outputId)` OR `get_ndi_status` (command already exists). (2) On toggle off: await `runDisableBroadcastOutput` before setting `enabled` false (or use pending/disabled UI while tearing down). (3) If either preview or NDI is active, show `enabled` true. |
| **Files** | `src/hooks/use-broadcast-output-settings.ts`, `use-broadcast-output-settings.test.ts`, possibly `broadcast-settings.tsx` |
| **Acceptance** | Tests: dialog open with mocked active NDI → `enabled` true; toggle off waits for teardown before UI shows off. |
| **Effort** | Medium (~2–4 hours) |

---

### T-04 — Remove duplicate `autoMode` / `confidenceThreshold` from detection store

| Field | Value |
| --- | --- |
| **Finding** | F-10 |
| **Severity** | Medium |
| **Owner** | 🤖 Agent |
| **Problem** | Same settings live in `detection-store` (unused defaults) and `settings-store` (authoritative). Footgun for future code. |
| **Fix** | Remove `autoMode`, `confidenceThreshold`, and their setters from `detection-store.ts`. Update `use-detection.ts` to read from `settings-store` if ever exposed, or drop unused exports. Update `detection-store.test.ts` / `verse-detection-workflow.test.ts` reset blocks. |
| **Files** | `src/stores/detection-store.ts`, `src/hooks/use-detection.ts`, related tests |
| **Acceptance** | `grep autoMode detection-store` returns nothing; all tests pass. |
| **Effort** | Small (~1 hour) |

---

### T-05 — Preview highest-confidence direct hit, not `directHits[0]`

| Field | Value |
| --- | --- |
| **Finding** | F-02 |
| **Severity** | Medium |
| **Owner** | 🤖 Agent |
| **Problem** | `handleVerseDetections` assumes batch order equals recency; previews first direct hit only. |
| **Fix** | Select `directHits` by max `confidence` (tie-break: first in batch). Add Rust comment at `verse_detections` emit sites documenting that order is not guaranteed. Optionally sort in workflow for deterministic tests. |
| **Files** | `src/lib/verse-detection-workflow.ts`, `verse-detection-workflow.test.ts`, `src-tauri/src/commands/stt/detection.rs` (comment only) |
| **Acceptance** | New test: batch `[low-conf direct, high-conf direct]` previews high-conf verse. |
| **Effort** | Small (~1–2 hours) |

---

### T-06 — Stabilize monitor selection across refresh (name-based resolution)

| Field | Value |
| --- | --- |
| **Finding** | F-08 |
| **Severity** | High |
| **Owner** | 🤖 Agent (frontend); optional Rust follow-up |
| **Problem** | `SelectItem value={String(i)}` — index shifts when OS reorders monitors. |
| **Fix (phase 1 — agent)** | Build stable key `name|width|height` per monitor. Persist selected key in broadcast store (or resolve on each `fetchMonitors`). Map key → current index before `open_broadcast_window`. Update `clampMonitorIndex` → `resolveMonitorIndex(monitors, storedKey)`. |
| **Fix (phase 2 — optional)** | Extend `MonitorInfo` with Tauri monitor id if API exposes one; persist id instead of composite key. |
| **Files** | `BroadcastOutputCard.tsx`, `broadcast-settings-wiring.ts`, `broadcast-settings.tsx`, `broadcast-store.ts`, tests |
| **Caveat** | Duplicate monitors with same name+resolution need disambiguation (show index suffix in UI). |
| **Acceptance** | Unit test: reorder monitor array → same physical monitor still selected by key. |
| **Effort** | Medium (~3–5 hours) |

---

### T-07 — Fix misleading `addDetections` comment and add else-branch test

| Field | Value |
| --- | --- |
| **Finding** | F-01 |
| **Severity** | Medium |
| **Owner** | 🤖 Agent |
| **Problem** | Lines 222–230 comment says “incoming won on confidence” in the branch where state detection lost on confidence and recency. |
| **Fix** | Correct comment to describe actual behavior (stale state merged without winning rank). Add test constructing map entry that wins over state `d` on both axes, assert merge output. |
| **Files** | `src/stores/detection-store.ts`, `detection-store.test.ts` |
| **Acceptance** | Test fails if else branch removed; comment matches branch condition. |
| **Effort** | Small (~1 hour) |

---

### T-08 — In-flight guard on preview and NDI toggle handlers

| Field | Value |
| --- | --- |
| **Finding** | F-06 |
| **Severity** | Medium |
| **Owner** | 🤖 Agent |
| **Problem** | Double-click can fire duplicate `start_ndi` / `open_broadcast_window`. |
| **Fix** | `useRef` or `useState` `busy` flag; disable buttons while promise in flight; ignore duplicate clicks. |
| **Files** | `use-broadcast-output-settings.ts`, `BroadcastOutputCard.tsx` (disabled prop), tests |
| **Acceptance** | Test: second call while first pending is no-op or queued. |
| **Effort** | Small (~1–2 hours) |

---

### T-09 — Reconcile `ndiActive` when broadcast settings dialog opens

| Field | Value |
| --- | --- |
| **Finding** | F-07 |
| **Severity** | Medium |
| **Owner** | 🤖 Agent |
| **Problem** | Preview state polled every 750ms; NDI local state never synced from backend on open. |
| **Fix** | On dialog open, call existing `get_ndi_status` per output (`main` / `alt`); set `ndiActive` from `response?.active`. Mirror pattern used for `reconcileBroadcastPreviewState`. |
| **Files** | `use-broadcast-output-settings.ts`, `broadcast-settings.tsx`, tests |
| **Acceptance** | Test with mocked `get_ndi_status` returning active → `ndiActive` true on mount. |
| **Effort** | Small (~1–2 hours) |

---

### T-10 — Toast when manual `detect_verses` fails

| Field | Value |
| --- | --- |
| **Finding** | F-09 |
| **Severity** | Medium |
| **Owner** | 🤖 Agent |
| **Problem** | `detectionActions.detectVerses` catches errors, `console.warn`, returns `[]` — looks like “no detections”. |
| **Fix** | `toast.error` with dedupe id; keep returning `[]` for safe UI. |
| **Files** | `src/hooks/use-detection.ts`, `use-transcription.test.ts` or new `use-detection.test.ts` |
| **Acceptance** | Test mocks failed invoke → notifier called. |
| **Effort** | Small (~1 hour) |

---

### T-11 — Toast when detection settings sync to backend fails

| Field | Value |
| --- | --- |
| **Finding** | (extends F-09 pattern) |
| **Severity** | Medium |
| **Owner** | 🤖 Agent |
| **Problem** | `useDetectionSettingsSync` logs `console.warn` on `update_detection_settings` failure; auto-live threshold may be wrong server-side. |
| **Fix** | One-time toast on sync failure; optional retry. |
| **Files** | `src/hooks/use-detection-settings-sync.ts`, new test file |
| **Acceptance** | Test: failed invoke → toast path exercised. |
| **Effort** | Small (~1 hour) |

---

### T-12 — Operator hint when verse fetch falls back to snippet/chapter cache

| Field | Value |
| --- | --- |
| **Finding** | F-03 |
| **Severity** | Low–Medium |
| **Owner** | 🤖 Agent |
| **Problem** | `resolveDetectionVerse` silent `catch` — wrong text can queue without operator knowing. |
| **Fix** | Return metadata `{ verse, usedFallback: boolean }` or emit subtle toast/debug badge in queue item when fallback used. Prefer non-blocking hint (toast once per detection id). |
| **Files** | `src/lib/verse-detection-workflow.ts`, tests |
| **Acceptance** | Test: fetch rejects → fallback text used and hint flag set. |
| **Effort** | Small–Medium (~2 hours) |

---

### T-13 — Serialize overlapping `handleVerseDetections` calls

| Field | Value |
| --- | --- |
| **Finding** | F-04 |
| **Severity** | Low |
| **Owner** | 🤖 Agent |
| **Problem** | Concurrent events can race on `queue-store` via `Promise.all`. |
| **Fix** | Module-level promise chain or mutex: each `handleVerseDetections` awaits previous completion. |
| **Files** | `src/lib/verse-detection-workflow.ts`, tests |
| **Acceptance** | Test: two overlapping calls complete without duplicate queue entries for same verse. |
| **Effort** | Small (~1–2 hours) |

---

### T-14 — Add regression tests bundle for P0/P1 fixes

| Field | Value |
| --- | --- |
| **Findings** | F-01 through F-12 (coverage gaps) |
| **Severity** | — |
| **Owner** | 🤖 Agent |
| **Problem** | Several fixes above need tests listed per task; this task tracks the combined CI run. |
| **Fix** | After T-01–T-13, run `bun run test -- --run` and `cargo test`; add any missing cases from findings doc regression plan. |
| **Acceptance** | All unit tests green; new tests fail on pre-fix behavior (before/after standard). |
| **Effort** | Ongoing (verify after each task) |

---

## 🤖+👤 Agent implements — you must verify manually

Hardware, real NDI, or multi-monitor behavior cannot be fully validated in CI alone.

---

### T-15 — Manual multi-monitor hotplug verification

| Field | Value |
| --- | --- |
| **Finding** | F-08 |
| **Severity** | High |
| **Owner** | 🤖+👤 |
| **Depends on** | T-06 |
| **Agent delivers** | Name-based monitor resolution code + unit tests |
| **You verify** | Plug/unplug HDMI; hit Refresh; confirm slide still targets intended display name |
| **Pass criteria** | Selected monitor label in UI matches physical display after reorder |

---

### T-16 — Manual NDI failure path verification

| Field | Value |
| --- | --- |
| **Finding** | F-12 |
| **Severity** | High |
| **Owner** | 🤖+👤 |
| **Depends on** | T-01 |
| **Agent delivers** | Operator-visible NDI push error |
| **You verify** | NDI running to OBS; stop NDI SDK / kill sender / disconnect network; confirm toast or status appears within seconds |
| **Pass criteria** | Operator not required to open devtools |

---

### T-17 — Manual broadcast sync failure verification

| Field | Value |
| --- | --- |
| **Finding** | F-11 |
| **Severity** | High |
| **Owner** | 🤖+👤 |
| **Depends on** | T-02 |
| **Agent delivers** | Toast on `emitTo` failure |
| **You verify** | Close broadcast webview manually while live; trigger go-live; confirm operator sees sync error |
| **Pass criteria** | Message names main vs alt output |

---

### T-18 — End-to-end live service smoke test

| Field | Value |
| --- | --- |
| **Findings** | Multiple |
| **Severity** | — |
| **Owner** | 🤖+👤 |
| **Depends on** | T-01–T-06 minimum |
| **Agent delivers** | Code fixes + existing Playwright spec |
| **You verify** | Full operator flow: start STT → detection → queue → go live → NDI + projector → toggle off |
| **Pass criteria** | No silent failures; enabled switch matches reality |

---

## 👤 You-only tasks (agent cannot complete)

---

### T-19 — Approve UX for `enabled` toggle semantics

| Field | Value |
| --- | --- |
| **Finding** | F-05 |
| **Owner** | 👤 You |
| **Why agent stops** | Product decision: should `enabled` mean “output armed”, “preview open”, “NDI active”, or all-of-the-above? |
| **Options** | A) Master arm switch (current intent). B) Separate preview/NDI indicators only — remove misleading master switch. C) Show sub-status chips (Preview / NDI / Off). |
| **Unblocks** | T-03 implementation details |
| **Effort** | 15-minute decision |

---

### T-20 — Expand E2E coverage for go-live / queue / detection flows

| Field | Value |
| --- | --- |
| **Source** | Prior production-safe review Criterion 3 |
| **Owner** | 👤 You (prioritize scenarios) → 🤖 Agent can write specs once scenarios defined |
| **Why split** | Agent can add Playwright tests, but **you** must define which operator flows are release-blocking |
| **Suggested scenarios** | Detection event → preview update; queue advance → live; reading mode auto-live |
| **Files** | `tests/e2e/*.spec.ts`, `desktop-ci.yml` (already gates e2e) |

---

### T-21 — Adopt meaningful commit messages / PR descriptions

| Field | Value |
| --- | --- |
| **Source** | Production-safe review Criterion 5 |
| **Owner** | 👤 You |
| **Why agent stops** | Process discipline; agent can write messages when **you ask** to commit, but cannot change team habit |
| **Recommendation** | Conventional commits: `fix(broadcast): surface NDI push failures (T-01)` |

---

### T-22 — NDI performance / load assessment

| Field | Value |
| --- | --- |
| **Source** | Verification layer gap (findings §7) |
| **Owner** | 👤 You |
| **Why agent stops** | Requires real GPU/CPU profiling at 1080p60 with base64 IPC frames |
| **Question to answer** | Is `push_ndi_frame` base64 over IPC sustainable at 30/60 fps on target hardware? |

---

### T-23 — Real Tauri integration test strategy

| Field | Value |
| --- | --- |
| **Source** | Findings §4 structural gap |
| **Owner** | 👤 You (decide) → 🤖 Agent can scaffold if you choose approach |
| **Options** | A) `tauri-driver` / WebDriver E2E only (current). B) Rust command integration tests with mock AppHandle. C) Dedicated staging build on CI with display fixture. |
| **Why you** | Cost/time tradeoff for CI infrastructure |

---

### T-24 — Sign-off checklist before production hardening

| Field | Value |
| --- | --- |
| **Owner** | 👤 You |
| **Checklist** | |
| | ☐ T-01–T-06 complete |
| | ☐ T-15–T-18 manual QA passed |
| | ☐ T-19 UX decision recorded |
| | ☐ No P0 findings open |
| | ☐ `bun run test -- --run` + `cargo test` green |

---

## Task index (quick reference)

| Task | Title | Owner | Finding | Priority |
| --- | --- | --- | --- | --- |
| **T-01** | Surface NDI push failures | 🤖 | F-12 | P0 |
| **T-02** | Surface broadcast sync failures | 🤖 | F-11 | P0 |
| **T-03** | Fix `enabled` toggle desync | 🤖 | F-05 | P0 |
| **T-04** | Remove duplicate detection settings | 🤖 | F-10 | P1 |
| **T-05** | Preview by confidence not index | 🤖 | F-02 | P1 |
| **T-06** | Stable monitor selection | 🤖 | F-08 | P1 |
| **T-07** | Fix comment + else-branch test | 🤖 | F-01 | P2 |
| **T-08** | In-flight toggle guard | 🤖 | F-06 | P2 |
| **T-09** | Reconcile NDI on dialog open | 🤖 | F-07 | P2 |
| **T-10** | Toast on `detect_verses` fail | 🤖 | F-09 | P2 |
| **T-11** | Toast on settings sync fail | 🤖 | — | P2 |
| **T-12** | Verse fetch fallback hint | 🤖 | F-03 | P3 |
| **T-13** | Serialize detection handler | 🤖 | F-04 | P3 |
| **T-14** | Regression test bundle / CI green | 🤖 | All | — |
| **T-15** | Manual multi-monitor QA | 🤖+👤 | F-08 | P1 |
| **T-16** | Manual NDI failure QA | 🤖+👤 | F-12 | P0 |
| **T-17** | Manual sync failure QA | 🤖+👤 | F-11 | P0 |
| **T-18** | Live service smoke test | 🤖+👤 | Multiple | P0 |
| **T-19** | Approve `enabled` UX | 👤 | F-05 | P0 |
| **T-20** | Expand E2E scenarios | 👤→🤖 | — | P1 |
| **T-21** | Commit message discipline | 👤 | — | P3 |
| **T-22** | NDI performance assessment | 👤 | — | P3 |
| **T-23** | Integration test strategy | 👤 | — | P3 |
| **T-24** | Production sign-off checklist | 👤 | — | — |

---

## What to ask the agent to do next

Copy-paste ready:

> **Option A — P0 only:** “Execute T-01, T-02, T-03, and T-14.”

> **Option B — Full agent batch:** “Execute T-01 through T-13 and T-14.”

> **Option C — Single task:** “Execute T-06 only.”

**Blocker:** T-03 should wait for **T-19** if you want a specific UX for the `enabled` switch. If you accept the proposed fix in T-03 (derive enabled from preview OR NDI active), say so and the agent can proceed without T-19.

---

## Finding → task mapping

| Finding | Task(s) |
| --- | --- |
| F-01 | T-07 |
| F-02 | T-05 |
| F-03 | T-12 |
| F-04 | T-13 |
| F-05 | T-03, T-19, T-18 |
| F-06 | T-08 |
| F-07 | T-09 |
| F-08 | T-06, T-15 |
| F-09 | T-10 |
| F-10 | T-04 |
| F-11 | T-02, T-17 |
| F-12 | T-01, T-16 |

---

*Generated from code logic review findings. Update this report as tasks close.*
