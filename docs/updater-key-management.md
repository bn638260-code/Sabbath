# SabbathCue updater key management

SabbathCue ships signed auto-updates via [Tauri updater](https://v2.tauri.app/plugin/updater/). Installers and `latest.json` are published as **GitHub Releases on this repo** ([`bn638260-code/Sabbath`](https://github.com/bn638260-code/Sabbath)).

The repo must stay **public** so installed apps can fetch update metadata and installers anonymously (no GitHub login in the updater).

## Why not a separate releases repo

Earlier builds pointed at `Bongisto/sabbathcue-releases`. That org is reserved for other release types. SabbathCue desktop releases now live on `bn638260-code/Sabbath` and CI publishes with the workflow `GITHUB_TOKEN` — no cross-repo PAT required.

## One-time setup (operator)

1. Generate a minisign keypair locally (never commit the private key):

   ```powershell
   bun run tauri signer generate -w $env:USERPROFILE\.tauri\sabbathcue.key
   ```

2. Add GitHub Actions secrets on **`bn638260-code/Sabbath`**:
   - `TAURI_SIGNING_PRIVATE_KEY` — full contents of `sabbathcue.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — password chosen during generation

3. Paste the **public** key (contents of `sabbathcue.key.pub`) into `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.

4. Back up the private key and password in a password manager. **Losing the private key permanently bricks the update channel** for existing installs; users would need a manual reinstall.

## Release workflow

`Release Desktop Build` (`.github/workflows/release-desktop.yml`):

1. Builds with signing env vars → NSIS `.exe`, MSI, `.sig` files
2. Generates `latest.json` (canonical artifact: NSIS `.exe` on `windows-x86_64`)
3. Publishes a **non-draft, non-prerelease** GitHub Release on this repo via `gh release create`

Verify after release (logged-out browser / private window):

`https://github.com/bn638260-code/Sabbath/releases/latest/download/latest.json`

## Local signed builds

To produce a signed installer plus `.sig` outside CI (Git Bash):

```bash
export TAURI_SIGNING_PRIVATE_KEY="$HOME/.tauri/sabbathcue.key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(tail -c +4 "$HOME/.tauri/sabbathcue.key.password.txt" | tr -d '\r\n')"
bun run tauri:build:release
```

`TAURI_SIGNING_PRIVATE_KEY` accepts either a path or the key contents.

`sabbathcue.key.password.txt` was written by PowerShell with a UTF-8 BOM, so its
first three bytes are `EF BB BF`. Passing the file verbatim fails with
`incorrect updater private key password: Wrong password for that key` — note this
happens *after* the installer is bundled, so the `.exe` still appears while the
`.sig` is silently absent. `tail -c +4` drops the BOM. The same applies when
pasting into the GitHub secret: paste the 32 password characters only.

Plain `bun run tauri build` skips signing entirely (the base config sets
`createUpdaterArtifacts: false`) and yields an installer existing installs cannot
auto-update to.

## Migration from `sabbathcue-releases`

Installs that still poll `Bongisto/sabbathcue-releases` must **manually install one build** from `bn638260-code/Sabbath` that embeds the new updater endpoint. After that, auto-update uses this repo.

## Key rotation

Rotation requires a transition release signed with the **old** key while embedding the **new** public key, or asking all users to manually reinstall. Plan key rotation carefully; there is no silent in-app key swap without a coordinated release.

## MSI vs NSIS

The updater uses the **NSIS `.exe`** as the canonical Windows artifact. MSI remains a side download for manual installs; MSI-installed users may need a one-time manual switch to the `.exe` update path.

## SmartScreen

Windows SmartScreen warnings may still appear (unsigned Authenticode). Minisign updater signatures are separate and verify update integrity only.
