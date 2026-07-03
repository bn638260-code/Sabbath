# SabbathCue marketing site

Next.js 16 marketing site for [SabbathCue](https://github.com/Bongisto/SabbathCue). Static-only — no API routes, no server actions. Deployed to GitHub Pages on push to `main`.

## Develop

```bash
cd web
bun install
bun run dev
```

Opens [http://localhost:3029](http://localhost:3029).

## Build

```bash
bun run build
```

Outputs a static site to `web/out/`.

## Deploy

Pushes to `main` that touch `web/**` trigger `.github/workflows/deploy-web.yml`, which builds the static export and publishes it to GitHub Pages at [https://github.com/Bongisto/SabbathCue](https://github.com/Bongisto/SabbathCue).

To trigger a deploy without code changes (e.g., to refresh the GitHub stars count baked into the page), use the **Run workflow** button on the _Deploy web to GitHub Pages_ action in the GitHub UI.

PRs touching `web/**` run the build job only (no deploy) as a smoke test.

## Notes

- `output: "export"` in `next.config.ts` — static export is required for GitHub Pages. Anything that needs a Node server (route handlers, server actions, ISR, `next/image` optimization) will fail the build.
- `basePath: "/SabbathCue"` matches the GitHub Pages project-site prefix. Dev also serves under it: [http://localhost:3029/SabbathCue](http://localhost:3029/SabbathCue). Next.js does NOT rewrite CSS `url()` values or `manifest.ts` for `basePath`, so the font paths in `app/globals.css` and the icon/start_url in `app/manifest.ts` carry the `/SabbathCue/` prefix by hand — keep them in sync if the repo is ever renamed or moved to a custom domain.
- `getGitHubStars()` runs at build time. Authenticated via `GITHUB_TOKEN` in CI to avoid the 60/hr unauthenticated rate limit; falls back to a hardcoded count if the API call fails.
