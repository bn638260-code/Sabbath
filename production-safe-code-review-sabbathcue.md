# Production-Safe Code Review — SabbathCue (Whole App)

> **Production-safe code** is code that works correctly, fails safely, is maintainable, is tested, and can be monitored or rolled back when something goes wrong.

**Subject:** SabbathCue `v0.1.3` — Tauri v2 desktop app (React 19 + TypeScript frontend in `src/`, Rust workspace in `src-tauri/`)
**Scope:** Whole-app assessment (working tree clean on `main`, no pending diff). Each criterion is interpreted at the codebase level rather than for a single change.
**Reviewed:** Tuesday, Jun 9, 2026

---

## 1. Does it solve the actual problem?

The app delivers its stated purpose: real-time sermon transcription, Bible verse detection, and broadcast-ready overlays. The major feature areas are all wired end to end through 55 registered Tauri commands.

**Sub-checks:**

- [x] Requirement is clearly understood and written down — `README.md` documents features, STT options, and the public-release build path.
- [x] Code behavior matches the requirement exactly — detection pipeline, STT (Vosk default + Deepgram), broadcast/NDI, hymnal, and service plans are all implemented and registered (`src-tauri/src/lib.rs`, `src/components/layout/dashboard.tsx`).
- [x] Edge cases in the requirement are handled — backend survives frontend reloads by resetting STT on boot (`src/main.tsx`); audio device loss triggers a retry loop rather than a crash (`src-tauri/src/commands/stt.rs`).
- [~] It was tested against the real scenario (not just locally) — CI exercises typecheck/lint/unit/Rust tests, but full operator flows (go live, queue advance, detection -> slide) rely on manual QA; the single E2E spec is not gated in CI.

**Evidence:**

- Command surface: `src-tauri/src/lib.rs` (invoke handler registration), with thin handlers under `src-tauri/src/commands/` (`bible.rs`, `detection.rs`, `stt.rs`, `broadcast.rs`, `remote.rs`, `secrets.rs`, `assets.rs`).
- Feature routing: `src/stores/dashboard-workspace-store.ts` workspace modes (`live`, `run-service`, `service-plans`, `hymns`, `live-service`, `live-hymns`, `sermon-slides`, `settings`).
- Cross-cutting glue: `src/lib/presentation-workflow.ts` connects detection -> queue -> broadcast preview/live.

**Verdict:** `[x] Pass` `[ ] Partial` `[ ] Fail`

**Notes:** Functionally complete and coherent. The main "real scenario" gap is verification depth, not capability: critical live-production flows are not covered by automated end-to-end testing in CI (see Criterion 3).

---

## 2. Is the code small and scoped?

For a whole-app review this criterion is interpreted as **modularity and boundary discipline** rather than diff size. The architecture is well-separated, with a few seams of inconsistency.

**Sub-checks:**

- [x] You can describe the change in one sentence — equivalently, each module has a clear single purpose (6 Rust crates with distinct responsibilities; feature-folder React components).
- [x] Only files relevant to the change were modified — equivalently, concerns are isolated: stores in `src/stores/`, pure logic in `src/lib/`, domain services in `src/services/`, UI in `src/components/`.
- [~] No unnecessary refactoring or complexity was added — `src-tauri/crates/notes/` (`rhema-notes`) is a stub that is not a workspace member and not used; it is dead code on disk.
- [~] AI-generated code was reviewed for scope creep — two IPC patterns coexist: the guarded `invokeTauri()` wrapper (`src/lib/tauri-runtime.ts`) and direct `invoke()` calls (e.g. `src/hooks/use-transcription.ts`, `src/hooks/use-broadcast-output-runtime.ts`).

**Evidence:**

- Crate boundaries (`src-tauri/Cargo.toml`): `rhema-audio`, `rhema-stt`, `rhema-bible`, `rhema-detection`, `rhema-broadcast`, `rhema-api` — each single-purpose and Tauri-free where possible (`rhema-api` is the OSC/HTTP remote layer).
- Dead code: `src-tauri/crates/notes/src/lib.rs` ("Planned: Claude API, sermon notes"), absent from `[workspace].members`.
- IPC seam: `src/lib/tauri-runtime.ts` `invokeTauri()` enforces a runtime guard; some hooks bypass it with direct `invoke()`.

**Verdict:** `[ ] Pass` `[x] Partial` `[ ] Fail`

**Notes:** Boundaries are good and the codebase is genuinely modular. Two cleanups would push this to Pass: remove or wire up the `rhema-notes` stub, and standardize on `invokeTauri()` so the runtime guard is applied consistently.

---

## 3. Are there tests?

Strong unit coverage where the product logic is most complex (Rust detection engine, remote API), meaningful frontend business-logic coverage, but thin UI/IPC/native coverage and E2E excluded from CI.

**Sub-checks:**

- [x] Normal (happy path) case is tested — ~399 Rust tests across 42 modules; 41 frontend Vitest files covering presentation, service plan, detection, stores.
- [x] Failure case is tested — STT error parsing, HTTP auth rejection, poison-recovery, and validation bounds are tested (`src-tauri/crates/api/src/http.rs`, `src-tauri/src/commands/`).
- [x] At least one edge case is tested — long-verse/lyric chunking, repeated hymn sections, render-key dedup (`src/services/hymnal/generate-hymn-screens.test.ts`, `src/lib/broadcast-render-key.test.ts`).
- [~] Regression test added if this fixes a bug — present in places, but there is no enforced policy and large surfaces are untested.

**Test matrix (production-relevant surfaces):**

| Surface | Tested? | Evidence |
| --- | --- | --- |
| Verse detection pipeline (Rust) | `[x]` Heavy (~250 tests) | `src-tauri/crates/detection/` |
| Remote API / OSC / HTTP (Rust) | `[x]` Strong (~75 tests) | `src-tauri/crates/api/` |
| STT providers (Rust) | `[~]` Moderate | `rhema-stt` (vosk/whisper/deepgram); `provider.rs`, `error.rs` untested |
| Bible/EGW data layer (Rust) | `[~]` Partial | `search`/`egw`/`crossref` tested; `db.rs`, `lookup.rs` untested |
| Presentation/service-plan (frontend) | `[x]` Good | `src/lib/service-plan/*.test.ts`, `src/lib/presentation-workflow*.test.ts` |
| React UI components | `[ ]` ~6% by file | only 5 component `.test.tsx` vs ~79 components |
| NDI / native broadcast (Rust) | `[ ]` None | `rhema-broadcast` has zero tests |
| Tauri command modules | `[~]` ~50% | `broadcast`, `remote`, `bible`, `egw`, `audio`, `validation` lack direct tests |
| End-to-end operator flow | `[~]` 1 spec, not in CI | `tests/e2e/broadcast-output.spec.ts` |

**Evidence:**

- Runner/config: Vitest in `vite.config.ts`, setup `src/test/setup.ts`; scripts `bun run test` / `test:unit` in `package.json`.
- CI gating: `.github/workflows/desktop-ci.yml` runs typecheck, Vitest (`bun run test -- --run`), lint, build, `npm audit`, and `cargo check/test/clippy` + `cargo deny` — but no Playwright step.

**Verdict:** `[ ] Pass` `[x] Partial` `[ ] Fail`

**Notes:** The riskiest production surfaces (NDI output, several Tauri command modules, full operator flows) are the least tested. Highest-value additions: CI-gated E2E for go-live/queue/detection flows, NDI runtime tests, and command-module tests for `broadcast`/`remote`.

---

## 4. Does it fail safely?

This is a relative strength. Errors are returned rather than thrown as panics, optional subsystems degrade gracefully, and secrets stay in the OS keychain. The gaps are in user-facing feedback for secondary failures and one debug-logging risk.

**Sub-checks:**

- [x] Errors produce a clear, user-readable message — critical paths (STT start/stop, broadcast toggles) surface Sonner toasts (`src/hooks/use-transcription.ts`, `src/components/broadcast/broadcast-settings.tsx`).
- [x] No data is destroyed or corrupted on failure — queue refinement uses immutable copies (`src/stores/queue-store.ts`); theme import validates JSON depth/size before writing (`src-tauri/src/commands/theme_files.rs`).
- [x] App does not freeze or enter a broken state — global panic hook (`src-tauri/src/lib.rs`), `catch_unwind` around STT tasks, and poison-recovery on locks (`src-tauri/src/commands/stt.rs`); detection pause fails closed.
- [~] Private information is never leaked in error output — secrets are kept out of logs and held in the keychain, but `SABBATHCUE_DEBUG_TRANSCRIPTS` can log spoken transcript content, and the Deepgram WebSocket URL (with keyterms) is logged at info level.

**Evidence:**

- Error contract: Tauri commands return `Result<T, String>` consistently; typed internal errors via `thiserror` (`src-tauri/crates/stt/src/error.rs` `SttError`, plus `DetectionError`, `NdiError`, `AudioError`, `CommandError`).
- Graceful degradation: semantic search disabled (not fatal) when ONNX/embeddings absent (`src-tauri/src/lib.rs`), with FTS5 + Fuse.js fallback (`src-tauri/src/commands/detection.rs`, `src/components/panels/search-panel.tsx`).
- Secrets: keychain via `src-tauri/src/commands/secrets.rs`; no read-back command for the Deepgram key; HTTP remote binds `127.0.0.1` with constant-time bearer compare (`src-tauri/crates/api/src/http.rs`).
- Silent failures: `.catch(() => {})` on NDI/window sync (`src/stores/broadcast-store.ts`, `broadcast-settings.tsx`); `push_ndi_frame` failure only `console.warn` (`src/hooks/use-broadcast-output-runtime.ts`); `asset_status` failure sets status to `null` with no toast (`src/hooks/use-assets.ts`).

**Verdict:** `[x] Pass` `[ ] Partial` `[ ] Fail`

**Notes:** Pass on the core safety guarantees (no data loss, no uncontrolled crashes, secrets protected). Harden before production by (1) gating `SABBATHCUE_DEBUG_TRANSCRIPTS` so it cannot leak transcripts in release, (2) surfacing NDI/broadcast sync failures to the operator instead of swallowing them, and (3) showing a toast when `asset_status` fails.

---

## 5. Is it understandable?

The code itself is readable and conventional, with documented patterns. The weak point is project history hygiene and leftover stubs, which hurt "what changed and why / how to roll back."

**Sub-checks:**

- [x] You can explain what the code does in plain language — clear module names and documented store/action patterns (`src/hooks/use-bible.ts`, `src/hooks/use-detection.ts`).
- [~] You know which files were changed and why — every recent git commit message is literally `commit`, so history conveys no intent and rollback reasoning is hard.
- [x] You can identify what could break — boundaries make blast radius clear (IPC contracts, store persistence, detection/STT pipelines, broadcast window).
- [x] You know how to roll back the change — version control is in place; the obstacle is message quality, not mechanism.

**Evidence:**

- Strictness aids comprehension: `tsconfig.app.json` `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`; build gate `tsc -b && vite build`.
- Documented conventions: stable `*Actions` objects to avoid re-render loops (`src/hooks/use-bible.ts`).
- Hygiene drag: uniform `commit` messages in `git log`; dead `rhema-notes` crate (`src-tauri/crates/notes/`).

**Verdict:** `[ ] Pass` `[x] Partial` `[ ] Fail`

**Notes:** The source is understandable; the project record is not. Adopt meaningful commit messages (and ideally PR descriptions) and remove the dead crate so a future reader can answer "why did this change?" without archaeology.

---

## 6. Does it follow the existing app's patterns?

Highly consistent. The app uses one state library, one styling system, one component library, and predictable file organization throughout.

**Sub-checks:**

- [x] Follows existing naming and code conventions — hooks `use-*.ts`, stores `*-store.ts`, kebab-case libs, `@/*` path alias.
- [x] Uses the same state/data patterns already in the project — Zustand `create()` stores with selective `@tauri-apps/plugin-store` persistence; `hydrate*()` at boot.
- [x] No new library added without justification — established stack (React 19, Tauri 2, Zustand, Fabric.js for the design canvas only, Fuse.js for client search).
- [x] Styling matches the existing design system — Tailwind v4 + shadcn/ui, `cn()` (`src/lib/utils.ts`), CVA variants, 34 components under `src/components/ui/`, `lucide-react` icons, `sonner` toasts.

**Evidence:**

- State barrel: `src/stores/index.ts`; persistence pattern in `src/stores/settings-store.ts`.
- Styling: `src/index.css` (`@import "shadcn/tailwind.css"`), `src/lib/utils.ts` `cn()`.
- Consistent secret handling via keychain (`src-tauri/src/commands/secrets.rs`).

**Verdict:** `[x] Pass` `[ ] Partial` `[ ] Fail`

**Notes:** Strong fit. The only consistency wrinkle is the dual `invokeTauri()` vs direct `invoke()` usage already noted in Criterion 2.

---

## Summary scorecard

| # | Criterion | Verdict |
| --- | --- | --- |
| 1 | Solves the actual problem | `[x] Pass / [ ] Partial / [ ] Fail` |
| 2 | Small and scoped (modularity) | `[ ] Pass / [x] Partial / [ ] Fail` |
| 3 | Has tests | `[ ] Pass / [x] Partial / [ ] Fail` |
| 4 | Fails safely | `[x] Pass / [ ] Partial / [ ] Fail` |
| 5 | Understandable | `[ ] Pass / [x] Partial / [ ] Fail` |
| 6 | Fits the existing codebase | `[x] Pass / [ ] Partial / [ ] Fail` |

**Overall verdict:** Partials present -> **Address before production hardening.** The app is functional, well-architected, and fails safely on its core paths; it is not blocked by any Fail, but should not be treated as fully production-hardened until the Partials are addressed.

### Prioritized action list

1. **Gate E2E in CI** — add the Playwright spec (`tests/e2e/broadcast-output.spec.ts`) to `.github/workflows/desktop-ci.yml` and expand it to cover go-live, queue advance, and detection -> slide. (Criterion 3)
2. **Test the riskiest untested surfaces** — NDI runtime in `rhema-broadcast`, and the `broadcast`/`remote`/`bible`/`egw`/`audio` Tauri command modules. (Criterion 3)
3. **Stop silent failures from reaching the operator unseen** — replace `.catch(() => {})` on NDI/broadcast sync and the `push_ndi_frame` `console.warn` with visible status; toast on `asset_status` failure. (Criterion 4)
4. **Lock down transcript debug logging** — ensure `SABBATHCUE_DEBUG_TRANSCRIPTS` cannot leak spoken content in release builds; drop keyterms from the logged Deepgram URL. (Criterion 4)
5. **Improve project record** — use meaningful commit messages / PR descriptions instead of `commit`. (Criterion 5)
6. **Remove or wire up dead code** — delete the `rhema-notes` stub or add it to the workspace with a purpose. (Criteria 2, 5)
7. **Standardize IPC** — route all calls through `invokeTauri()` so the runtime guard is applied uniformly. (Criteria 2, 6)

---

*Based on the production-safety framework: code that works correctly, fails safely, is maintainable, is tested, and can be monitored or rolled back. Evidence gathered from a structured exploration of the SabbathCue codebase; file paths cited are relative to the repository root.*
