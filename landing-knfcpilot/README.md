# KNFC Conference pilot landing page

Self-contained static landing page for the SabbathCue KNFC media-team pilot
(single `index.html`, no build step).

## Deploy to Vercel

**Team:** [sabbathcue on Vercel](https://vercel.com/sabbathcue)  
**Project:** `knfcpilot` → **https://knfcpilot.vercel.app/**  
**Git:** [bn638260-code/Sabbath](https://github.com/bn638260-code/Sabbath) (production branch deploys)

This folder is a standalone static site. It must **not** use the repo-root Vite
build — the root app builds to `build/`, not this landing.

### Vercel dashboard (GitHub auto-deploy) — recommended

1. Open **knfcpilot** under [vercel.com/sabbathcue](https://vercel.com/sabbathcue) → **Settings → General**.
2. Set **Root Directory** to `landing-knfcpilot` (not the repo root).
3. Under **Build & Development Settings** (or rely on this folder’s `vercel.json`):
   - **Framework Preset:** Other
   - **Build Command:** `node scripts/vercel-build.mjs`
   - **Output Directory:** `dist`
   - **Install Command:** leave empty / disabled
4. **Deployment Protection:** turn off **Vercel Authentication** for Production so the public pilot page is reachable without login.
5. **Redeploy** the latest `main` commit (Deployments → … → Redeploy).

The committed `vercel.json` in this folder sets the build command and output
directory; the dashboard root directory must still be `landing-knfcpilot`.

### Repo root as project root (fallback)

If **Root Directory** is `.`, the root `scripts/vercel-build.mjs` copies this
folder into `dist/` when `VERCEL_PROJECT_NAME` is `knfcpilot` or
`knfcsabbathcue`, and root `vercel.json` routes `/api/reviews` to
`landing-knfcpilot/api/reviews.js`.

### Vercel CLI

Log in to the **sabbathcue** team (not a personal scope) before deploying:

```bash
cd landing-knfcpilot
vercel link    # select team sabbathcue, project knfcpilot
vercel         # preview
vercel --prod  # production → knfcpilot.vercel.app
```

### Pilot review emails

Submitting the review form sends email to **sabbathcue@gmail.com** via
[FormSubmit](https://formsubmit.co/) from the visitor's browser. The first
submission triggers a one-time activation message to that inbox — click the
link once to enable delivery.

Optional: set `BLOB_READ_WRITE_TOKEN` on the **knfcpilot** project so
`/api/reviews` can also store reviews for the public list on the page.
