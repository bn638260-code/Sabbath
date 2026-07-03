# SabbathCue updater key management

SabbathCue ships signed auto-updates via [Tauri updater](https://v2.tauri.app/plugin/updater/). Installers and `latest.json` are published to the **public** releases-only repo [`Bongisto/sabbathcue-releases`](https://github.com/Bongisto/sabbathcue-releases). The source repo stays private.

## Why a separate public releases repo

GitHub anonymous downloads work for public release assets. The private `SabbathCue` repo cannot serve update URLs to installed apps without authentication. All updater endpoints and `latest.json` asset URLs **must** point at `sabbathcue-releases`.

## One-time setup (operator)

1. Generate a minisign keypair locally (never commit the private key):

   ```powershell
   bun run tauri signer generate -w $env:USERPROFILE\.tauri\sabbathcue.key
   ```

2. Add GitHub Actions secrets on the **private** `SabbathCue` repo:
   - `TAURI_SIGNING_PRIVATE_KEY` — full contents of `sabbathcue.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — password chosen during generation
   - `RELEASES_REPO_TOKEN` — fine-grained PAT with **Contents: Read and write** on `sabbathcue-releases` only

3. Paste the **public** key (contents of `sabbathcue.key.pub`) into `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`, replacing `REPLACE_WITH_PUBLIC_KEY_FROM_tauri_signer_generate`.

4. Back up the private key and password in a password manager. **Losing the private key permanently bricks the update channel** for existing installs; users would need a manual reinstall.

5. Create the public repo `Bongisto/sabbathcue-releases` with a short README (no source code).

## Release workflow

`Release Desktop Build` (`.github/workflows/release-desktop.yml`):

1. Builds with signing env vars → NSIS `.exe`, MSI, `.sig` files
2. Generates `latest.json` (canonical artifact: NSIS `.exe` on `windows-x86_64`)
3. Publishes a **non-draft, non-prerelease** GitHub Release on `sabbathcue-releases` via `gh release create --repo Bongisto/sabbathcue-releases`

Verify after release (logged-out browser / private window):

`https://github.com/Bongisto/sabbathcue-releases/releases/latest/download/latest.json`

## Bootstrap note

Existing **v0.1.3** installs have no updater. Users must **manually install v0.1.4 once**. Auto-update works from v0.1.4 → v0.1.5 onward.

## Key rotation

Rotation requires a transition release signed with the **old** key while embedding the **new** public key, or asking all users to manually reinstall. Plan key rotation carefully; there is no silent in-app key swap without a coordinated release.

## PAT renewal

`RELEASES_REPO_TOKEN` is a fine-grained PAT and **expires**. Set a long expiry, calendar a renewal reminder, and update the secret before it lapses. If the PAT expires, CI builds succeed but release publish fails.

## MSI vs NSIS

The updater uses the **NSIS `.exe`** as the canonical Windows artifact. MSI remains a side download for manual installs; MSI-installed users may need a one-time manual switch to the `.exe` update path.

## SmartScreen

Windows SmartScreen warnings may still appear (unsigned Authenticode). Minisign updater signatures are separate and verify update integrity only.
