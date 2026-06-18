# Code Refactoring & Improvement Plan

> **Unified action plan** synthesizing the three living reports for `sabbathcue`/`rhema`:
> [PERFORMANCE_TEST_REPORT.md](PERFORMANCE_TEST_REPORT.md) · [DEBUGGING_REPORT.md](DEBUGGING_REPORT.md) · [SECURITY_TEST_REPORT.md](SECURITY_TEST_REPORT.md).
> This is the single "what to do next" list. Each item links back to the finding it resolves.
> Legend: `[ ]` todo · `[~]` in progress · `[x]` done · 🔴 high · 🟡 medium · 🟢 low/healthy

---

## 0. Snapshot

| Field | Value |
|---|---|
| Target | `sabbathcue`/`rhema` — full repo |
| Date | 2026-06-18 |
| Commit | `d43f1de` (branch `main`) |
| Reviewer | Claude (Opus 4.8) |
| Goal | Reduce bundle weight + oversized hot-path files; close security verify-items; add measurement to CI — **no feature changes** |
| Test safety net | **Yes** — 603 unit tests / 89 files green (~13 s); typecheck + lint clean; e2e configured |

**Verdict:** The codebase is **healthy and well-disciplined** (0 lint warnings, 0 `any`, 0 debt markers, 0 npm vulns, secrets in OS keychain, strict CSP). There is **no correctness crisis and no rewrite case.** The work is incremental hardening: trim the bundle, split a handful of god-files, verify a few security items, and bolt measurement onto CI so this stays true.

---

## 1. What needs to be done — prioritized (Effort vs Impact)

|                 | **Low effort** | **High effort** |
|---|---|---|
| **High impact** | ⭐ **Quick wins** — split `vendor` chunk (R1); verify Supabase RLS (R7); harden `cargo deny` gate (R8) | 🎯 **Big bets** — live-service runtime profiling (R10); modularize `verse-renderer.ts` (R4) |
| **Low impact**  | 🟢 **Fill-ins** — leveled logger for `console.*` (R6); add coverage + complexity + jscpd to CI (R9); asset path containment (R11) | 🕳 **Defer** — rewrite vendored `sidebar.tsx`; data-drive builtin themes (R5) unless it blocks a feature |

**Recommended order:** R7 → R8 → R11 → R1 → R6 → R9 → R4 → R2/R3 → R10 → R5.
(Security verifies first — cheap and risk-reducing; then the bundle quick win; then tooling; then the structural extractions behind the test net; profiling once instrumented.)

---

## 2. Refactoring & Improvement Backlog

> Sequenced so each step keeps the build green. Prefer many small steps. Each row cites its source finding.

| # | Item | Source | Technique | Files affected | Risk | Status |
|---|---|---|---|---|:---:|:---:|
| R1 | Split monolithic `vendor` chunk (877 KB / 253 KB gz) into react / state / supabase / tauri sub-chunks | PERF-001 | edit `manualChunks` | [vite.config.ts](vite.config.ts) | 🟢 | `[x]` **done 2026-06-18** — vendor → 460 KB / 134 KB gz + react/supabase/tauri/state |
| R2 | Confirm `fabric`/`canvas` (280 KB) and `pdf.worker` (1.14 MB) are lazy, not in first-paint graph | PERF-002, PERF-005 | `React.lazy` audit | design-canvas, theme-designer, ppt-import | 🟢 | `[ ]` |
| R3 | Verify Tailwind content-globbing prunes unused CSS (`verse-renderer.css` 167 KB) | PERF-004 | build config check | tailwind/vite config | 🟢 | `[ ]` |
| R4 | Extract `wrapText` / layout-math / draw from `verse-renderer.ts` (1,197 LOC, hot path) | DBG #2 | extract module | [src/lib/verse-renderer.ts](src/lib/verse-renderer.ts) | 🟡 | `[ ]` |
| R5 | Data-drive or split builtin themes (1,467 LOC) | DBG #1 | extract data | [src/lib/builtin-themes.ts](src/lib/builtin-themes.ts) | 🟢 | `[ ]` |
| R6 | Introduce leveled logger; replace 67 stray `console.*` | DBG #6 / SEC §2.12 | wrap + replace | `src/**` (67 sites) | 🟢 | `[ ]` |
| R7 | **Verify RLS enabled + explicit policies on every Supabase table; least-privilege RPCs** | SEC-001 | DB review | `supabase/migrations/**` | 🟡 | `[ ]` |
| R8 | Gate Rust crate advisories in CI | SEC-002 | tooling | [src-tauri/deny.toml](src-tauri/deny.toml) | 🟢 | `[x]` **done 2026-06-18** — `cargo deny check` already in CI (0 issues / 696 crates); hardened `workspace → all` + 8 documented ignores |
| R9 | Add `vitest --coverage`, `eslint complexity`, `jscpd` to CI (Rust advisories already gated via `cargo deny`, hardened in R8) | DBG B3 | CI tooling | [.github/workflows/desktop-ci.yml](.github/workflows/desktop-ci.yml) | 🟢 | `[~]` cargo-deny portion done (R8); coverage/complexity/jscpd pending |
| R10 | Live-service runtime profiling (FPS, memory growth, detection latency over 90 min) | PERF-003 | instrument + soak | `main.tsx`, broadcast path | 🟡 | `[ ]` |
| R11 | Add `starts_with(app_dir)` containment after `canonicalize()` for imported assets | SEC-003 | guard clause | [src-tauri/src/commands/assets.rs](src-tauri/src/commands/assets.rs) | 🟢 | `[ ]` |
| R12 | Confirm verification/device token storage location + logout invalidation | SEC-004 | review | [src/lib/verification/session-storage.ts](src/lib/verification/session-storage.ts) | 🟢 | `[ ]` |
| R13 | Decouple video-control + persistence from `broadcast-store` (856 LOC) | DBG #3 | store slices | [src/stores/broadcast-store.ts](src/stores/broadcast-store.ts) | 🟡 | `[ ]` |

---

## 3. Pre-flight Safety Checklist

- [x] Test safety net covers target behavior (603 tests; verse-renderer & broadcast have dedicated tests)
- [x] Tests green and fast (~13 s) — run before/after every step
- [ ] Work on a branch; small, reviewable PRs per item
- [x] Behavior-preservation agreed: R1–R6, R13 are **structure-only**; R7–R12 are verification/tooling
- [x] Rollback plan: each step is one revertable commit; tree currently clean
- [ ] Stakeholders know no features ship in this pass

## 4. Per-Item Loop

1. [ ] Confirm tests green (`npx vitest --run` + `npx tsc --noEmit` + `npx eslint .`)
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

| Metric | Before (2026-06-18) | After | Δ |
|---|---|---|---|
| Largest single raw chunk | 877 KB (`vendor`) | 460 KB (`vendor`) | **−417 KB** (R1) |
| `vendor` gzipped | 253 KB | 134 KB | **−119 KB** (R1) |
| Total JS bundle (raw) | 3.9 MB | 3.9 MB | ~0 (split, not removed) |
| Max non-data file (LOC) | 1,467 (`builtin-themes.ts`) | 1,467 | pending (R5) |
| Test coverage | not instrumented | not instrumented | pending (R9) |
| Lint warnings | 0 | 0 | ➖ |
| npm + cargo vulnerabilities | 0 npm / cargo not run | **0 npm / 0 cargo** | ✅ (R8) |
| Open security verify-items | 5 (SEC-001…005) | 4 (SEC-002 closed) | **−1** (R8) |

## 7. Open Questions & Follow-ups

- [ ] Should the `web/` Next.js sub-project get its own perf + security assessment? (out of current scope)
- [ ] Is a coverage **threshold** wanted as a hard CI gate, or report-only to start?
- [ ] Target bundle budget — is 350 KB gz initial the right ceiling for a desktop app, or can it relax?

---

### Appendix — commands used to produce the baseline

```bash
npx tsc --noEmit              # typecheck — clean
npx eslint .                  # lint — 0 warnings
npx vitest --run              # 603 tests / 89 files pass (~13 s)
npx vite build                # production build (9.2 s) + bundle report
npm audit --json              # 0 vulnerabilities
git log --since='12 months ago' --name-only --format=format: \
  | grep -v '^$' | sort | uniq -c | sort -rn | head   # churn hotspots
```
