# Security Testing Report

> **Living document.** This file reflects the *current* security state of the codebase. Update it with every change that affects security (new feature, dependency bump, auth change, config change, fix). Never delete history — move resolved items to the Change Log.

| Field | Value |
|---|---|
| **Last updated** | `2026-06-18 16:40` |
| **Updated by** | `Claude (Opus 4.8) — automated assessment` |
| **Commit / build** | `d43f1de` (branch `main`, clean tree) |
| **Overall status** | 🟢 Secure (with verify/monitor items) |
| **Open criticals** | `0` |
| **Open highs** | `0` |

> **Scope note.** `sabbathcue`/`rhema` is a **Tauri 2 desktop app** with a thin Supabase backend (auth + device registration + announcements). Threat model is **local-first desktop** (no untrusted multi-tenant web surface), plus a small authenticated Supabase API. Classic web-server categories (CSRF cookies, HTTP security headers, server endpoint hardening) are largely **N/A** to the desktop binary and noted as such; the Supabase side is assessed via its migrations/RLS.

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ Pass | Tested, no issue found |
| ⚠️ Warning | Works but has a weakness / partial coverage / needs verification |
| ❌ Fail | Vulnerability or gap confirmed |
| 🧪 Not tested | Not yet assessed |
| 🔵 N/A | Doesn't apply to this codebase |

**Severity scale:** `Critical` > `High` > `Medium` > `Low` > `Info`

---

## 1. Summary Dashboard

| Area | Status | Last checked | Notes |
|---|---|---|---|
| Authentication | ✅ | 2026-06-18 | Supabase Auth; password-reset flow present; no custom crypto |
| Authorization / access control | ⚠️ | 2026-06-18 | RLS migrations present incl. `004_lockdown_rls_auto_enable`; verify policy coverage per table |
| Input validation & sanitization | ✅ | 2026-06-18 | No string-built SQL; Rust commands typed |
| Injection (SQL / NoSQL / command) | ✅ | 2026-06-18 | No SQL concatenation found; no `shell:execute` capability granted |
| Cross-site scripting (XSS) | ✅ | 2026-06-18 | 0 `dangerouslySetInnerHTML`, 0 `eval`/`new Function`; React auto-escaping; strict CSP |
| CSRF protection | 🔵 | 2026-06-18 | N/A — no cookie-session web surface; Supabase uses bearer tokens |
| Secrets & credential management | ✅ | 2026-06-18 | API keys in **OS keychain** via `keyring`; `.env` gitignored & untracked |
| Dependency / supply-chain | ✅ | 2026-06-18 | CI-gated: `npm audit` **0** + `cargo deny check` **0** (696 crates). `deny.toml` hardened to `all` scope; 8 transitive advisories documented in `ignore` |
| Data protection & encryption | ✅ | 2026-06-18 | TLS to Supabase; keychain at rest; updates minisign-signed |
| Session management | ⚠️ | 2026-06-18 | `persistSession:false`, custom verification token store; verify token-at-rest handling |
| API / endpoint security | ⚠️ | 2026-06-18 | Supabase RPCs (`register_device`) + RLS; verify least-privilege on RPCs |
| Security headers & transport | ✅ | 2026-06-18 | Strict CSP in `tauri.conf.json`; `frame-ancestors 'none'`, `object-src 'none'` |
| Logging, auditing & monitoring | ✅ | 2026-06-18 | No secrets/tokens logged; 67 `console.*` log messages only, not values |
| Error handling / info disclosure | ✅ | 2026-06-18 | User-facing errors via `toast`; no stack-trace leakage to UI found |
| File upload / handling | ⚠️ | 2026-06-18 | Asset import uses `canonicalize()`; verify traversal containment under app dir |

---

## 2. Detailed Findings

### 2.1 Authentication

- **Status:** ✅ Pass
- **Checked:** auth provider, password reset, credential storage.
- **Findings:**
  - Authentication is delegated to **Supabase Auth** ([src/lib/supabase/auth.ts](src/lib/supabase/auth.ts)); no hand-rolled password hashing or token signing. Password-reset flow exists with an explicit redirect URL ([src/lib/supabase/password-reset-url.ts](src/lib/supabase/password-reset-url.ts)).
  - Missing-config is handled defensively: the client throws a clear error if `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` are absent ([src/lib/supabase/client.ts](src/lib/supabase/client.ts:9)) — fails closed, not open.
  - **Verify (👤):** brute-force/rate-limiting and lockout are Supabase-dashboard settings, not in-repo — confirm they are enabled.

### 2.2 Authorization / Access Control

- **Status:** ⚠️ Warning (verify)
- **Checked:** RLS, server-side enforcement, device registration.
- **Findings:**
  - **RLS is enabled** via migrations, including a dedicated lockdown migration [supabase/migrations/004_lockdown_rls_auto_enable.sql](supabase/migrations/004_lockdown_rls_auto_enable.sql). Device registration uses an RPC ([001_devices_and_register_rpc.sql](supabase/migrations/001_devices_and_register_rpc.sql)) with a race-fix follow-up (003). This is the correct pattern — auth enforced server-side, not in the client.
  - **Verify (👤):** confirm **every** table (devices, accounts, announcements) has RLS enabled with explicit policies, and that RPCs run with least privilege (`security definer` functions scoped tightly). The anon key is — by design — embedded in the client bundle; **all real protection is the RLS layer.**

### 2.3 Input Validation & Injection

- **Status:** ✅ Pass
- **Checked:** SQL building, command injection, path traversal, deserialization.
- **Findings:**
  - No string-concatenated SQL in Rust (`grep` for `format!`/`query(` over `src-tauri` found only a `remove_file` call, not SQL). DB access goes through typed paths / Supabase client.
  - **No command execution capability** is granted to the frontend (see §2.10 capabilities) — command injection surface is effectively closed.
  - Path traversal: asset handling uses `canonicalize()` ([src-tauri/src/commands/assets.rs](src-tauri/src/commands/assets.rs:288)) and `asset_paths.rs` normalizes the Windows `\\?\` prefix. **Verify (🤖):** add/confirm a `starts_with(app_dir)` containment check after canonicalization for user-supplied filenames.

### 2.4 XSS & Output Encoding

- **Status:** ✅ Pass
- **Checked:** DOM/stored/reflected XSS, dangerous sinks, CSP.
- **Findings:**
  - **Zero** `dangerouslySetInnerHTML`, **zero** `eval`/`new Function` in `src/`. React's default escaping applies.
  - **Strict CSP** in [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json:26): `default-src 'self'`; `object-src 'none'`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`. `script-src` is limited to `'self'` + YouTube domains (for sermon/media embeds) — **no `'unsafe-inline'` or `'unsafe-eval'` on scripts** (only `style-src 'unsafe-inline'`, the common Tailwind tradeoff).
  - **Info:** `connect-src` is correctly pinned to `'self'` + the specific Supabase project URL.

### 2.5 CSRF

- **Status:** 🔵 N/A
- **Findings:** The desktop app has no cookie-based session surface; Supabase requests carry bearer tokens, not ambient cookies. No state-changing GET endpoints in-repo.

### 2.6 Secrets & Credential Management

- **Status:** ✅ Pass
- **Checked:** hardcoded secrets, env hygiene, token storage.
- **Findings:**
  - **API keys (Deepgram, Gladia, etc.) are stored in the OS keychain** via the `keyring` crate ([src-tauri/src/commands/secrets.rs](src-tauri/src/commands/secrets.rs)) — Windows Credential Manager / macOS Keychain — **not** in plaintext or the JSON plugin-store. The store trait is mockable for tests. This resolves the open question raised in the debugging report.
  - `.env` is **gitignored and not tracked** (`git ls-files` confirms it is unknown to git). `.env.template` documents required keys without values.
  - The Supabase **anon key** is intentionally a public client key (protected by RLS), injected at build via `VITE_SUPABASE_ANON_KEY`. This is the Supabase-recommended pattern, not a leak — provided RLS is enforced (§2.2).

### 2.7 Dependencies / Supply Chain

- **Status:** ✅ Pass
- **Checked:** `npm audit`, lockfiles, CVEs.
- **Findings:**
  - `npm audit`: **0 vulnerabilities** (info/low/moderate/high/critical all 0) as of 2026-06-18; gated in CI (`npm audit --audit-level=moderate`).
  - **Rust deps are gated in CI by `cargo-deny`** (`cargo deny check`, the `rust` job in [.github/workflows/desktop-ci.yml](.github/workflows/desktop-ci.yml)) — **0 vulnerabilities** across 696 crates. Config is [src-tauri/deny.toml](src-tauri/deny.toml).
  - **Hardened (R8/R9, 2026-06-18):** `deny.toml` advisories scope changed `workspace → all`, so **any new transitive unmaintained/unsound crate now fails CI** (previously only direct workspace deps were flagged). The **8** currently-accepted advisories are listed in `ignore` with per-crate source + rationale: `fxhash` + 5× `unic-*` (transitive via Tauri's `tauri-utils`), `paste` (transitive via HuggingFace `tokenizers`), and `rand` (RUSTSEC-2026-0097, unsound only with a custom logger calling `rand::rng()` — not our code path). All are non-exploitable maintenance/soundness advisories with no upstream fix available.
  - A broader ad-hoc `cargo audit` (all targets, all transitive) additionally lists ~10 Linux-only GTK3-bindings advisories (`atk`/`gdk`/`gtk`/`glib`/…, RUSTSEC-2024-04xx) pulled by Tauri's webkit2gtk backend; these are **out of scope for the Windows-only build** and will retire upstream when Tauri/wry move off GTK3.
  - Lockfiles committed (`package-lock.json`, `bun.lock`); Rust pins via `Cargo.lock` + `rust-toolchain.toml`.

### 2.8 Data Protection & Encryption

- **Status:** ✅ Pass
- **Findings:** Transport to Supabase is HTTPS (CSP `connect-src` is `https://…supabase.co`). Secrets encrypted at rest by the OS keychain. Auto-updates are **minisign-signed** (`updater.pubkey` set in [tauri.conf.json](src-tauri/tauri.conf.json:61)) — tampered update payloads are rejected.

### 2.9 Session Management

- **Status:** ⚠️ Warning (verify)
- **Findings:** The Supabase client is configured with `persistSession: false` and `autoRefreshToken: false` ([src/lib/supabase/client.ts](src/lib/supabase/client.ts:24)), and a **custom verification token store** exists ([src/lib/verification/session-storage.ts](src/lib/verification/session-storage.ts)). **Verify (🤖+👤):** confirm where the verification/device token is persisted (keychain vs. plugin-store vs. localStorage) and that logout clears it. If it lives in the keychain, this becomes ✅.

### 2.10 API / Endpoint Security

- **Status:** ⚠️ Warning (verify) — Tauri IPC: ✅
- **Findings:**
  - **Tauri capabilities are least-privilege.** [capabilities/default.json](src-tauri/capabilities/default.json) grants only `core:default`, `set-fullscreen`, `store`, `dialog`, `updater`, `process:allow-restart`; desktop adds only `global-shortcut`. **No `shell`, no broad `fs`, no `http` allowlist** — a compromised renderer cannot spawn processes or read arbitrary files.
  - Supabase RPCs/tables: see §2.2 — verify RLS + RPC privilege scoping.

### 2.11 Security Headers & Transport

- **Status:** ✅ Pass (CSP) / 🔵 N/A (HTTP headers)
- **Findings:** Classic response headers (HSTS, X-Frame-Options) are N/A for a local webview, but the equivalent protections are enforced via **CSP** (§2.4) and Tauri window isolation. `frame-ancestors 'none'` prevents clickjacking of the webview content.

### 2.12 Logging, Auditing & Info Disclosure

- **Status:** ✅ Pass
- **Findings:** A scan for `console.*` calls logging `key|token|secret|password` found only one message that logs a **failure event** (not the token value) in [session-storage.ts](src/lib/verification/session-storage.ts:53). No secrets or PII observed in logs. 67 total `console.*` calls in source — recommend routing through `@tauri-apps/plugin-log` with levels (overlaps debugging-report finding #6).

---

## 3. Open Issues Tracker

| ID | Severity | Area | Description | Status | Owner | Opened | Target |
|---|---|---|---|---|---|---|---|
| SEC-001 | Medium | AuthZ | Verify RLS enabled + explicit policies on **every** Supabase table and least-privilege on RPCs | Open | 👤 | 2026-06-18 | next release |
| SEC-002 | Low | Supply chain | Gate Rust crate advisories in CI | **Fixed (R8/R9, 2026-06-18)** — `cargo deny` already in CI; hardened to `all` scope + 8 documented ignores. New advisories now fail CI | 🤖 | 2026-06-18 | done |
| SEC-003 | Low | File handling | Add/confirm `starts_with(app_dir)` containment after `canonicalize()` for imported asset paths | Open | 🤖 | 2026-06-18 | next release |
| SEC-004 | Low | Session | Confirm verification/device token storage location + logout invalidation | Open | 🤖+👤 | 2026-06-18 | next release |
| SEC-005 | Info | Auth | Confirm Supabase brute-force/rate-limit + lockout enabled in dashboard | Open | 👤 | 2026-06-18 | next release |

---

## 4. Tools & Methods Used

| Tool / method | Version | Scope | Last run |
|---|---|---|---|
| `npm audit` | npm CLI | JS dependency CVEs (0 found) | 2026-06-18 |
| Manual source review | — | CSP, capabilities, secrets, injection sinks, XSS sinks | 2026-06-18 |
| `git ls-files` | git | Secret/`.env` tracking check | 2026-06-18 |
| Migration review | — | Supabase RLS / RPC posture | 2026-06-18 |
| `cargo deny check` | 0.19.7 | Rust advisories/licenses/bans/sources — CI gate (0 issues / 696 crates) | 2026-06-18 |
| `cargo audit` | 0.21+ | Ad-hoc cross-target Rust advisory scan (0 vulns; 21 maintenance warnings) | 2026-06-18 |
| DAST / pen test | — | Runtime attack surface | 🧪 not run |

---

## 5. Change Log

> Append newest entries at the top. One row per update to this report.

| Date | By | Summary of change | Items affected |
|---|---|---|---|
| `2026-06-18` | Claude (Opus 4.8) | **R8/R9: hardened Rust dep gate.** Confirmed `cargo deny check` already in CI (0 issues); changed `deny.toml` advisories scope `workspace → all` and documented 8 accepted transitive advisories in `ignore`. New advisories now fail CI. SEC-002 closed. | §2.7 Dependencies |
| `2026-06-18` | Claude (Opus 4.8) | Initial assessment. Strong posture: keychain secrets, strict CSP, least-privilege Tauri capabilities, signed updates, 0 npm vulns, RLS present. 5 verify/low items opened (SEC-001…005). | All sections |

---

## How to maintain this report

1. Re-run the relevant checks for any area touched by a change.
2. Update the **status symbol**, **Last checked** date, and **Findings** for that area.
3. Add or update rows in the **Open Issues Tracker**; move fixed items to "Fixed" but keep them.
4. Recompute the header (**Overall status**, **Open criticals/highs**).
5. Add a **Change Log** entry. Bump the date/commit in the header.
