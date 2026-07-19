# KNFC Conference pilot landing page

Self-contained static landing page for the SabbathCue KNFC media-team pilot
(single `index.html`, no build step).

## Deploy to Vercel

This folder is a standalone static site. It must **not** deploy from the repo
root — the root is a Vite/Tauri app whose build output is `build/`, not `dist/`.

### Vercel dashboard (GitHub auto-deploy)

Preferred: point the project at this folder.

1. Open the **knfcsabbathcue** project in Vercel → **Settings → General**.
2. Set **Root Directory** to `landing-knfcpilot` (not `.` or the repo root).
3. Under **Build & Development Settings**:
   - **Framework Preset**: Other
   - **Build Command**: leave empty / disabled
   - **Output Directory**: `.`
   - **Install Command**: leave empty / disabled
4. Redeploy the latest commit.

The committed `vercel.json` in this folder reinforces those settings once the
root directory is correct.

If the project must deploy from the repo root, the root `scripts/vercel-build.mjs`
copies this folder into `dist/` when `VERCEL_PROJECT_NAME=knfcsabbathcue`.

### Vercel CLI

```bash
cd landing-knfcpilot
vercel        # preview
vercel --prod # production
```

When prompted, use this folder as the project root.
