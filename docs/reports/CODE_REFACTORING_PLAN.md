# Code Refactoring & Improvement Plan

> **Unified action plan** synthesizing the living reports for `sabbathcue`/`rhema`:
> [CODE_QUALITY_REPORT.md](CODE_QUALITY_REPORT.md) · [PERFORMANCE_TEST_REPORT.md](PERFORMANCE_TEST_REPORT.md) · [DEBUGGING_REPORT.md](DEBUGGING_REPORT.md) · [SECURITY_TEST_REPORT.md](SECURITY_TEST_REPORT.md).
> This is the single "what to do next" list. Each item links back to the finding it resolves.
> Legend: `[ ]` todo · `[~]` in progress · `[x]` done · 🔴 high · 🟡 medium · 🟢 low/healthy

---

## 0. Snapshot

| Field           | Value                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target          | `sabbathcue`/`rhema` — full repo                                                                                                                                      |
| Date            | 2026-06-24 (quality audit + refactor branch validation) · 2026-06-18 (perf/security baseline)                                                                         |
| Commit          | Audit baseline `9db05ab` (`main`); execution branch through `c61347c` (`refactor/code-quality-safe-fixes`)                                                            |
| Reviewer        | Claude (Opus 4.8)                                                                                                                                                     |
| Goal            | Reduce bundle weight + oversized hot-path files; close security verify-items; add measurement to CI — **no feature changes**                                          |
| Test safety net | **Yes** — 697 unit tests / 99 files green (~24 s); coverage, build, e2e, lint, TypeScript, and Rust workspace checks green on the refactor branch after `c61347c`     |

**Verdict:** The codebase is **healthy and well-disciplined** (0 lint errors, 0 `any`, 0 debt markers, 0 npm vulns, secrets in OS keychain, strict CSP). There is **no correctness crisis and no rewrite case.** The work is incremental hardening: trim the bundle, split a handful of god-files, verify a few security items, and bolt measurement onto CI so this stays true.

---

## 1. What needs to be done — prioritized (Effort vs Impact)

<!-- markdownlint-disable MD060 -->
<!-- Emoji cell content makes Prettier and markdownlint disagree on column width; alignment is cosmetic here. -->

|                 | **Low effort**                                                                                                                    | **High effort**                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **High impact** | ⭐ **Quick wins** — split `vendor` chunk (R1); verify Supabase RLS (R7); harden `cargo deny` gate (R8)                            | 🎯 **Big bets** — live-service runtime profiling (R10); modularize `verse-renderer.ts` (R4)              |
| **Low impact**  | 🟢 **Fill-ins** — leveled logger for `console.*` (R6); add coverage + complexity + jscpd to CI (R9); asset path containment (R11) | 🕳 **Defer** — rewrite vendored `sidebar.tsx`; data-drive builtin themes (R5) unless it blocks a feature |

<!-- markdownlint-enable MD060 -->

**Recommended order:** R7 → R8 → R11 → R1 → R6 → R9 → R4 → R2/R3 → R10 → R5.
(Security verifies first — cheap and risk-reducing; then the bundle quick win; then tooling; then the structural extractions behind the test net; profiling once instrumented.)

---

## 2. Refactoring & Improvement Backlog

> Sequenced so each step keeps the build green. Prefer many small steps. Each row cites its source finding.

| #   | Item                                                                                                  | Source             | Technique           | Files affected                                                                                                              | Risk |                                                                 Status                                                                  |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------- | :--: | :-------------------------------------------------------------------------------------------------------------------------------------: |
| R1  | Split monolithic `vendor` chunk (877 KB / 253 KB gz) into react / state / supabase / tauri sub-chunks | PERF-001           | edit `manualChunks` | [vite.config.ts](vite.config.ts)                                                                                            |  🟢  |                          `[x]` **done 2026-06-18** — current branch vendor → 471 KB / 139 KB gz + react/supabase/tauri/state             |
| R2  | Confirm `fabric`/`canvas` (280 KB) and `pdf.worker` (1.14 MB) are lazy, not in first-paint graph      | PERF-002, PERF-005 | `React.lazy` audit  | design-canvas, theme-designer, ppt-import                                                                                   |  🟢  |                                                                  `[ ]`                                                                  |
| R3  | Verify Tailwind content-globbing prunes unused CSS (`verse-renderer.css` 172 KB)                      | PERF-004           | build config check  | tailwind/vite config                                                                                                        |  🟢  |                                                                  `[ ]`                                                                  |
| R4  | Extract `wrapText` / layout-math / draw from `verse-renderer.ts` (1,126 LOC, hot path)                | DBG #2             | extract module      | [src/lib/verse-renderer.ts](src/lib/verse-renderer.ts)                                                                      |  🟡  |                                                                  `[ ]`                                                                  |
| R5  | Data-drive or split builtin themes (1,422 LOC)                                                        | DBG #1             | extract data        | [src/lib/builtin-themes.ts](src/lib/builtin-themes.ts)                                                                      |  🟢  |                                                                  `[ ]`                                                                  |
| R6  | Introduce leveled logger; replace 67 stray `console.*`                                                | DBG #6 / SEC §2.12 | wrap + replace      | `src/**` (67 sites)                                                                                                         |  🟢  |                                                                  `[ ]`                                                                  |
| R7  | **Verify RLS enabled + explicit policies on every Supabase table; least-privilege RPCs**              | SEC-001            | DB review           | `supabase/migrations/**`                                                                                                    |  🟡  |                                                                  `[ ]`                                                                  |
| R8  | Gate Rust crate advisories in CI                                                                      | SEC-002            | tooling             | [src-tauri/deny.toml](src-tauri/deny.toml)                                                                                  |  🟢  | `[x]` **done 2026-06-18** — `cargo deny check` already in CI (0 issues / 696 crates); hardened `workspace → all` + 8 documented ignores |
| R9  | Add `vitest --coverage` (gated), `eslint complexity` (warn), `jscpd` to CI                            | DBG B3             | CI tooling          | [.github/workflows/desktop-ci.yml](.github/workflows/desktop-ci.yml), `vitest.config.ts`, `eslint.config.js`, `.jscpd.json` |  🟢  |          `[x]` **done 2026-06-18** — coverage floor ~40%, complexity warn@20, jscpd<3%; Rust advisories via `cargo deny` (R8)           |
| R10 | Live-service runtime profiling (FPS, memory growth, detection latency over 90 min)                    | PERF-003           | instrument + soak   | `main.tsx`, broadcast path                                                                                                  |  🟡  |                                                                  `[ ]`                                                                  |
| R11 | Add `starts_with(app_dir)` containment after `canonicalize()` for imported assets                     | SEC-003            | guard clause        | [src-tauri/src/commands/assets.rs](src-tauri/src/commands/assets.rs)                                                        |  🟢  |                                                                  `[ ]`                                                                  |
| R12 | Confirm verification/device token storage location + logout invalidation                              | SEC-004            | review              | [src/lib/verification/session-storage.ts](src/lib/verification/session-storage.ts)                                          |  🟢  |                                                                  `[ ]`                                                                  |
| R13 | Continue `broadcast-store` decomposition (now 318 LOC facade + slices)                               | CQ-002, DBG #3     | store slices        | [src/stores/broadcast-store.ts](src/stores/broadcast-store.ts), `src/stores/broadcast/**`                                  |  🟡  | `[~]` **partial 2026-06-24** — output issues, designer, monitor/projector, video, and persistence extracted; theme/live facade remains |
| R14 | Continue live detection loop peel from `stt/detection.rs` (now 1,154 LOC)                            | CQ-001             | extract module      | `src-tauri/src/commands/stt/detection.rs`, `src-tauri/src/commands/stt/detection_logic.rs`, `src-tauri/src/commands/stt/detection_jobs.rs`, `crates/detection/**` |  🔴  | `[~]` **partial 2026-06-24** — pure detection logic and semantic job scheduling extracted; live session orchestration remains          |
| R15 | Shared `supabase/rpc.ts` — consolidate 4 duplicate RPC modules                                        | CQ-003             | extract helper      | `src/lib/supabase/*.ts`                                                                                                     |  🟢  |                                                                  `[ ]`                                                                  |
| R16 | Generic `useApiKeySettings` (Deepgram + Gladia hooks)                                                 | CQ-004             | extract hook        | `src/hooks/use-*-key-settings.ts`                                                                                           |  🟢  |                                                                  `[ ]`                                                                  |
| R17 | Pure `resolveDetectionVerse`; decouple from `reportOutputIssue`                                       | CQ-005             | extract + boundary  | [src/lib/verse-detection-workflow.ts](src/lib/verse-detection-workflow.ts)                                                  |  🟢  |                                                                  `[ ]`                                                                  |
| R18 | Isolate e2e/demo harness to entry boundary (`bootstrap({ mode })`)                                    | CQ-006             | entry refactor      | `src/main.tsx`, `use-tauri-event.ts`, `workflow-trace.ts`                                                                   |  🟢  |                                                                  `[ ]`                                                                  |
| R19 | Hymnal static data → lazy JSON or SQLite asset                                                        | CQ-008             | asset move          | `src/data/sda-hymnal-*`                                                                                                     |  🟢  |                                                                  `[ ]`                                                                  |

---

## 3. Pre-flight Safety Checklist

- [x] Test safety net covers target behavior (697 tests; verse-renderer & broadcast have dedicated tests)
- [x] Tests green and fast (~24 s for unit tests) — run before/after every step
- [ ] Work on a branch; small, reviewable PRs per item
- [x] Behavior-preservation agreed: R1–R6, R13 are **structure-only**; R7–R12 are verification/tooling
- [x] Rollback plan: each step is one revertable commit; tree currently clean
- [ ] Stakeholders know no features ship in this pass

## 4. Per-Item Loop

1. [ ] Confirm tests green (`npm.cmd run test:unit` + `npm.cmd run build` + `npm.cmd run lint`)
2. [ ] Make **one** small change
3. [ ] Re-run tests / rebuild — still green? bundle changed as expected?
4. [ ] Commit (`refactor: split vendor chunk`, `chore(ci): add coverage gate`, `fix(security): contain asset path`)
5. [ ] Repeat — if red > 1 min, revert and take a smaller step

## 5. Definition of Done

- [ ] R1–R13 done or consciously deferred (with reason)
- [ ] Tests green; coverage baseline recorded (R9)
- [ ] Initial gzipped JS reduced below 350 KB budget (R1/R2)
- [ ] SEC-001…004 resolved or accepted with rationale
- [ ] §6 metrics re-measured and recorded
- [ ] No behavior change (structure-only); PRs reviewed and merged

## 6. Results (re-measure after the pass)

| Metric                       | Before (2026-06-18)         | After                   | Δ                        |
| ---------------------------- | --------------------------- | ----------------------- | ------------------------ |
| Largest app vendor chunk     | 877 KB (`vendor`)           | 471 KB (`vendor`)       | **−406 KB** (R1)         |
| `vendor` gzipped             | 253 KB                      | 139 KB                  | **−114 KB** (R1)         |
| Total JS bundle (raw)        | 3.9 MB                      | 3.9 MB                  | ~0 (split, not removed)  |
| Max frontend logic file (LOC) | 1,197 (`verse-renderer.ts`) | 1,126                   | pending (R4)             |
| Test coverage (all `src/**`) | not instrumented            | **43.64% statements / gated** | ✅ measured + gated (R9) |
| Max cyclomatic complexity    | not measured                | **58 / warn-gated @20** | ✅ measured (R9)         |
| Duplication %                | not measured                | **0.71% / gated <3%**   | ✅ measured + gated (R9) |
| Lint errors                  | 0                           | 0                       | ➖                       |
| npm + cargo vulnerabilities  | 0 npm / cargo not run       | **0 npm / 0 cargo**     | ✅ (R8)                  |
| Open security verify-items   | 5 (SEC-001…005)             | 4 (SEC-002 closed)      | **−1** (R8)              |

## 7. Open Questions & Follow-ups

- [ ] Should the `web/` Next.js sub-project get its own perf + security assessment? (out of current scope)
- [ ] Is a coverage **threshold** wanted as a hard CI gate, or report-only to start?
- [ ] Target bundle budget — is 350 KB gz initial the right ceiling for a desktop app, or can it relax?

---

### Appendix — commands used to produce the baseline

```bash
npm.cmd run typecheck         # typecheck — clean
npm.cmd run lint              # lint — 0 errors
npm.cmd run test:unit         # 697 tests / 99 files pass (~24 s)
npm.cmd run build             # production build + bundle report
npm.cmd run test:e2e          # 8 Playwright tests pass
npm audit --json              # 0 vulnerabilities
git log --since='12 months ago' --name-only --format=format: \
  | grep -v '^$' | sort | uniq -c | sort -rn | head   # churn hotspots
```
