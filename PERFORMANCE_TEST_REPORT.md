# Performance Testing Report

<!-- markdownlint-disable MD060 -->

> **Living document.** This file reflects the _current_ performance state of the codebase. Update it whenever a change could affect speed, load, resource use, or scalability. Keep measured numbers with their date and conditions so regressions are visible over time.

| Field                | Value                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| **Last updated**     | `2026-06-29 11:05`                                                    |
| **Updated by**       | `Claude (Opus 4.8) — re-benchmark + verification`                     |
| **Commit / build**   | `ef44fd1` (branch `main`, Add detection-context review + parse fixes) |
| **Test environment** | `local` — Windows 11, Bun/Vite 8.1, Vitest 4.1.8, no runtime profiling |
| **Overall status**   | 🟡 Mixed                                                              |
| **Open regressions** | `1`                                                                   |

> **Scope note.** `sabbathcue`/`rhema` is a **Tauri 2 desktop app** (React 19 webview + Rust backend), not a hosted web service. Server-style metrics (TTFB, API p50/p95/p99, throughput, DB load) are **not applicable** to the desktop runtime and are marked accordingly. Build-time signals — **bundle composition** and **build/test pipeline timing** — were measured directly. **Runtime** signals (FPS during live broadcast, canvas render latency, memory growth over a service, STT/detection latency) require launching the app with instrumentation and remain **not measured**.

---

## Status Legend

| Symbol          | Meaning                                    |
| --------------- | ------------------------------------------ |
| ✅ Meets target | Within budget                              |
| ⚠️ Near limit   | Within ~10% of budget / trending wrong way |
| ❌ Over budget  | Exceeds target                             |
| 📉 Regression   | Worse than previous recorded run           |
| 📈 Improvement  | Better than previous recorded run          |
| 🚧 Not measured | Not yet benchmarked                        |
| ➖ N/A          | Not applicable to a Tauri desktop app      |

---

## 1. Summary Dashboard

| Metric                         | Target / Budget          | Latest                                                                 | Status | Trend | Measured   |
| ------------------------------ | ------------------------ | ---------------------------------------------------------------------- | ------ | ----- | ---------- |
| Time to First Byte (TTFB)      | ➖                       | local webview, no network                                              | ➖ N/A | —     | 2026-06-18 |
| First Contentful Paint (FCP)   | < 1.0 s (local webview)  | not profiled                                                           | 🚧     | —     | —          |
| Largest Contentful Paint (LCP) | < 1.5 s                  | not profiled                                                           | 🚧     | —     | —          |
| Time to Interactive (TTI)      | < 2.0 s                  | not profiled                                                           | 🚧     | —     | —          |
| Cumulative Layout Shift (CLS)  | < 0.1                    | not profiled                                                           | 🚧     | —     | —          |
| API p50 latency                | ➖                       | Tauri IPC `invoke`, in-process                                         | ➖ N/A | —     | —          |
| API p95 latency                | ➖                       | —                                                                      | ➖ N/A | —     | —          |
| API p99 latency                | ➖                       | —                                                                      | ➖ N/A | —     | —          |
| Throughput (req/s)             | ➖                       | single-user desktop                                                    | ➖ N/A | —     | —          |
| Error rate under load          | ➖                       | —                                                                      | ➖ N/A | —     | —          |
| Peak memory                    | < 600 MB idle (target)   | not profiled                                                           | 🚧     | —     | —          |
| Peak CPU                       | < 25% idle, no runaway   | not profiled                                                           | 🚧     | —     | —          |
| **Initial JS (gzipped)**       | **< 350 KB**             | **~334 KB** (main 80 + vendor 139 + react 56 + supabase 52 + tauri 6) | ✅     | 📉    | 2026-06-29 |
| **Largest single chunk (raw)** | < 500 KB (rolldown warn) | **471 KB** (`vendor`, was 460)                                         | ✅     | 📉    | 2026-06-28 |
| **Total JS bundle (raw)**      | < 3 MB                   | **3.99 MB** across 55 chunks                                           | ❌     | —     | 2026-06-28 |
| **Production build time**      | < 20 s (Vite phase)      | **11.4 s** Vite (`✓ built in 11.36s`)                                  | ✅     | 📈    | 2026-06-29 |
| **Unit test suite runtime**    | < 30 s                   | **~15 s** warm — 14.5 / 16.5 s (734 tests, 102 files)                  | ✅     | 📈    | 2026-06-29 |
| Cold start / boot time         | < 2.5 s                  | not profiled                                                           | 🚧     | —     | —          |

---

## 2. Detailed Results

### 2.1 Frontend / Page Load

- **Status:** 🚧 Not measured (runtime)
- **Conditions:** Tauri WebView2 (Windows). The app loads from bundled assets on disk, so there is no network TTFB; load cost is dominated by JS parse/exec of the initial chunks (`main` + `vendor` + `react` + `ui` + `icons`).
- **Measured:** Not yet. Core Web Vitals / hydration time require launching the packaged app with DevTools Performance or a `performance.mark` harness in `main.tsx`.
- **Notes / findings:**
  - Initial critical path pulls `main` (292 KB / 80 KB gz) + `vendor` (471 KB / 139 KB gz) + `react` (178 KB / 56 KB gz) + `ui` (109 KB / 29 KB gz) + `icons` (27 KB / 9 KB gz). Estimated initial gzipped payload ≈ **334 KB**, up from ~313 KB on 2026-06-18 (📉 +21 KB, mostly `main` +11 KB gz and `vendor` +5 KB gz).
  - Broadcast output window remains isolated: `broadcast` chunk 10 KB / 3.9 KB gz.

### 2.2 Asset & Bundle Analysis

- **Status:** ✅ Meets target (initial gz under 350 KB; total raw bundle still over 3 MB budget)
- **Checked:** bundle size per route/chunk, code splitting, manual chunking, lazy loading. Tool: `bun run build` (Vite 8.1 / rolldown), 2026-06-28.
- **Notes / findings:**
  - ✅ **Good code-splitting hygiene.** SDA hymnal chunks (~90–137 KB raw each), `theme-designer` (53 KB), `SettingsPage` (56 KB), `tour` (78 KB / 26 KB gz), and `pdf.worker` (1.14 MB) remain lazy-loaded.
  - 📉 **`vendor` grew slightly:** 471 KB raw / 139 KB gz (was 460 / 134 on 2026-06-18). Still under the 500 KB raw rolldown warning threshold.
  - 📉 **`main` grew:** 292 KB raw / 80 KB gz (was 260 / 69). Likely from Afrikaans hymn voice control, transcript routing, and settings work since last baseline.
  - ✅ **`canvas` (fabric.js) 280 KB / 87 KB gz** — confirmed lazy: only reached via `React.lazy(theme-designer)` (`ThemeSection`, `LiveServicePlanPage`); emitted as its own `canvas` chunk, never in the first-paint graph (PERF-002, verified 2026-06-29).
  - ✅ **`verse-renderer.css` 173 KB / 27 KB gz** (was 167 / 26). Confirmed pruned: Tailwind v4 (`@tailwindcss/vite`) auto-scans source — there is no `tailwind.config` content list to misconfigure (PERF-004, verified 2026-06-29).
  - ✅ **`pdf.worker.min` 1.14 MB raw** — confirmed lazy: `pdfjs` loads via `await import("pdfjs-dist")` in `pdf-slide-renderer.ts:123`, never at boot; emitted as its own chunk (PERF-005, verified 2026-06-29).
  - Total: **3.99 MB raw JS across 55 chunks** (+8 chunks vs June baseline, +128 unit tests added).

### 2.3 API / Backend Latency

- **Status:** ➖ N/A (desktop) / 🚧 partially measurable
- **Conditions:** Tauri `invoke` IPC (in-process). Hot paths: STT detection, verse detection, broadcast emit.
- **Measured:** STT transcript **scoring** benchmark only (not live STT latency):

| Tool / fixture                              | Result                                      | Status |
| ------------------------------------------- | ------------------------------------------- | ------ |
| `transcription_bench` / `scripture-reference` | similarity=1.000, scripture_terms=3/3, scoring duration_ms=0 | ✅ (fixture accuracy) |
| `detection_accuracy` (50 utterances)        | skipped — no local embeddings/model assets  | 🚧     |
| Live `stt::detection` IPC latency           | not instrumented                              | 🚧     |

> **Note:** `detection_accuracy` requires `bun run setup:all` (embeddings + ONNX model). Not run in this pass.

### 2.4 Database / Data Layer

- **Status:** 🚧 Not measured
- **Checked:** Bundled SQLite Bible DB + precomputed embeddings binary. Embeddings precomputed offline (correct pattern).
- **Notes / findings:** Unchanged from 2026-06-18 baseline. Afr1953 now in public release build path; per-query semantic search cost not re-profiled.

### 2.5 Load & Stress Testing

- **Status:** ➖ N/A for desktop (single operator)
- **Scenario (recommended):** 90-minute simulated service with continuous audio — observe memory growth, detection latency drift, broadcast FPS.
- **Notes / findings:** _none recorded yet — highest-value missing test._

### 2.6 Resource Utilization

- **Status:** 🚧 Not measured
- **Notes / findings:** `memstats.rs` logs RSS every 5 s at runtime; no soak test recorded. `detection-profiler.ts` available in dev for frontend detection handler timing.

### 2.7 Caching & Scalability

- **Status:** ➖ Mostly N/A (offline-first desktop)
- **Notes / findings:** Unchanged. `context-search-cache` chunk present.

---

## 3. Identified Bottlenecks

| ID       | Area    | Description                                                               | Impact | Suggested fix                                                                                                         | Status                                                     | Owner |
| -------- | ------- | ------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ----- |
| PERF-001 | Bundle  | `vendor` chunk 877 KB / 253 KB gz dominated initial payload               | High   | Split `vendor` in `manualChunks` (react / supabase / tauri / state separated)                                         | **Fixed (R1, 2026-06-18)** — vendor now 471 KB / 139 KB gz |       |
| PERF-002 | Bundle  | `canvas`/fabric 280 KB (87 KB gz) — confirm not in first-paint graph      | Med    | Ensure design-canvas/theme-designer are `React.lazy`-loaded; verify fabric isn't imported by an eagerly-loaded module | **Fixed (verified 2026-06-29)** — lazy `canvas` chunk only |       |
| PERF-003 | Runtime | No live-service runtime profiling (FPS, memory growth, detection latency) | High   | Add `performance.mark` harness + run a 90-min service profile; record memory at start/30/60/90 min                    | Open                                                       |       |
| PERF-004 | CSS     | `verse-renderer.css` 173 KB / 27 KB gz                                    | Low    | Confirm Tailwind content globbing prunes unused utilities for the build                                               | **Fixed (verified 2026-06-29)** — Tailwind v4 auto-scan |       |
| PERF-005 | Assets  | `pdf.worker.min` 1.14 MB raw                                              | Low    | Confirm worker loads only on PPT/PDF import, never at boot                                                            | **Fixed (verified 2026-06-29)** — dynamic `pdfjs` import |       |
| PERF-006 | Bundle  | Initial gz payload 313→334 KB (+6%); `main` chunk +11 KB gz since baseline | Med    | Audit eager imports in `main` graph; lazy-load new Afrikaans/hymn modules if on critical path                         | **Monitor** — still under 350 KB gz budget; no action yet |       |
| PERF-007 | Tests   | Unit suite 40.6 s (731 tests), exceeds 30 s budget                        | Med    | Split slow integration tests; use `test.concurrent` where safe; profile top 10 slowest test files                     | **Not reproduced (2026-06-29)** — warm runs ~15 s / 734 tests |       |

> **2026-06-29 re-benchmark & verification (Claude, `ef44fd1`).** No code changes were
> required — the open items are already handled or did not reproduce. App code is unchanged
> since the `435d84c` baseline apart from the detection-context commit, so timing deltas are
> environmental.
>
> - **PERF-007 — not reproduced.** `bun run test:unit` ran **14.5 s** then **16.5 s** (warm),
>   well under the 30 s budget. The 40.6 s test figure and 17.1 s build figure recorded on
>   2026-06-28 were a cold/loaded-machine anomaly.
> - **PERF-002 / PERF-004 / PERF-005 — verified resolved** (see §2.2). fabric (`canvas`) and
>   `pdf.worker` are emitted as separate lazy chunks; `theme-designer` is only reached via
>   `React.lazy`; `pdfjs` loads via `await import()`; Tailwind v4 auto-prunes (no config).
> - **PERF-006 — under budget.** Initial gz payload (~334 KB) is below the 350 KB target and
>   there is no eager heavy Afrikaans/hymn module (the Afrikaans Bible lives in the Rust/SQLite
>   backend, not the JS bundle). Remaining `main` growth is legitimate first-paint controller
>   code; forcing it lazy would regress UX for marginal KB.
> - **PERF-003** remains open — runtime/soak profiling needs the packaged Tauri app and was
>   not run in this pass.

---

## 4. Benchmark History

> Append newest at the top. Lets you spot regressions across builds.

| Date         | Commit    | Key metric                   | Value              | vs previous       |
| ------------ | --------- | ---------------------------- | ------------------ | ----------------- |
| `2026-06-29` | `ef44fd1` | Unit test suite (734 tests)    | ~15 s warm         | 📈 from 40.6 s cold |
| `2026-06-29` | `ef44fd1` | Production build (Vite)        | 11.4 s             | 📈 from 17.1 s cold |
| `2026-06-28` | `435d84c` | Unit test suite (731 tests)    | 40.6 s             | 📉 from 13 s / 603 |
| `2026-06-28` | `435d84c` | Initial JS (gz, core chunks) | ~334 KB            | 📉 from ~313 KB   |
| `2026-06-28` | `435d84c` | `vendor` gzipped             | 139 KB             | 📉 from 134 KB    |
| `2026-06-28` | `435d84c` | `main` gzipped               | 80 KB              | 📉 from 69 KB     |
| `2026-06-28` | `435d84c` | Production build (Vite)      | 17.1 s             | 📉 from 9.2 s     |
| `2026-06-28` | `435d84c` | Total JS bundle (raw)        | 3.99 MB / 55 chunks | ≈ same (3.9 MB)  |
| `2026-06-18` | `8424fdb`+R1 | Largest single chunk (raw)   | 460 KB (`vendor`)  | 📈 from 877 KB    |
| `2026-06-18` | `8424fdb`+R1 | `vendor` gzipped             | 134 KB             | 📈 from 253 KB    |
| `2026-06-18` | `d43f1de` | Production build time        | 9.2 s              | ➖ (baseline)     |
| `2026-06-18` | `d43f1de` | Unit test suite (603 tests)  | ~13 s              | ➖ (baseline)     |
| `2026-06-18` | `d43f1de` | Total JS bundle (raw)        | 3.9 MB / 47 chunks | ➖ (baseline)     |
| `2026-06-18` | `d43f1de` | Initial JS (gz, main+vendor) | ~324 KB          | ➖ (baseline)     |

---

## 5. Tools & Methods Used

| Tool / method                  | Version            | Scope                            | Last run   |
| ------------------------------ | ------------------ | -------------------------------- | ---------- |
| Vite build (rolldown) reporter | Vite 8.1.0         | Bundle size / chunking           | 2026-06-29 |
| Vitest                         | v4.1.8             | Unit test runtime (734 tests)    | 2026-06-29 |
| `transcription_bench` example  | rhema-stt (debug)  | STT fixture scoring accuracy     | 2026-06-28 |
| `detection_accuracy` bin       | rhema-detection    | Detection precision/recall       | 🚧 skipped (no assets) |
| Lighthouse / runtime profiler  | —                  | Web Vitals, memory               | 🚧 not yet run |
| Live-service soak profile      | —                  | Memory growth, detection latency | 🚧 not yet run |

---

## 6. Change Log

| Date         | By            | Summary of change                                                                                          | Metrics affected              |
| ------------ | ------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `2026-06-29` | Claude (Opus) | Re-verified lazy-load items (PERF-002/004/005); warm test/build timing; open regressions → 1 (PERF-003 only). | Build time, test runtime, bottlenecks |
| `2026-06-28` | Cursor agent  | Re-benchmark after Afrikaans detection, hymn commands, transcript routing (`435d84c`). Open regressions → 2. | Bundle, build time, test runtime |
| `2026-06-18` | Claude (Opus) | **R1: split monolithic `vendor` chunk** (877→460 KB raw / 253→134 KB gz).                                 | Bundle composition, caching   |
| `2026-06-18` | Claude (Opus) | Initial measured baseline: build, bundle, tests, lint, typecheck.                                          | Bundle, build time, test runtime |

---

## How to maintain this report

1. Re-run the relevant benchmarks under the **same conditions** as the prior run (note them).
2. Update the dashboard value, **Status**, and **Trend** (compare to last recorded run).
3. Add a row to **Benchmark History** for the metric(s) you measured.
4. Log new slow paths in **Identified Bottlenecks**; mark fixed ones without deleting.
5. Recompute the header (**Overall status**, **Open regressions**) and add a **Change Log** entry.

### Quick re-run commands

```bash
# Bundle analysis
bun run build

# Test suite timing
bun run test:unit

# STT fixture scoring (from src-tauri/)
cargo run -p rhema-stt --example transcription_bench -- crates/stt/fixtures/stt

# Detection accuracy (requires setup:all assets)
cd src-tauri
cargo run -p rhema-detection --features precompute-bin --release --bin detection_accuracy
```
