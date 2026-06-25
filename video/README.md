# SabbathCue launch video (Remotion)

Standalone Remotion project producing two renders from shared, orientation-aware scenes:

- **LaunchFilm** — 1920×1080, ~75s (website / YouTube)
- **SocialCut** — 1080×1920, ~30s (Reels / TikTok / Shorts)

Story: hook ("the moment") → voice/multilingual → reading mode → local-first → CTA.
Music + on-screen captions (no voiceover). Hybrid animated hero + real UI screenshots.

## Setup

```bash
cd video
npm install        # or: bun install / pnpm install
```

## Preview (live editor)

```bash
npm run dev        # opens Remotion Studio; pick LaunchFilm or SocialCut
```

## Render

```bash
npm run render        # -> out/launch-16x9.mp4
npm run render:social # -> out/social-9x16.mp4
npm run render:all    # both
```

> First render downloads a headless Chromium (one-time, needs network).

## Music (optional)

Drop a track at `public/music.mp3` and it's mixed in automatically (60% volume).
With no file present, the video renders silently — no code change needed.

## Editing

- **CTA URL** — `src/scenes/CTA.tsx`, the `SITE_URL` constant.
- **Brand colors / fonts** — `src/theme.ts`.
- **Scene order / durations** — `src/Film.tsx` (`LANDSCAPE` / `PORTRAIT` arrays).
- **Screenshots** — `public/screenshots/` (refreshed from `web/out/docs/screenshots/`).
- **Copy** — each scene in `src/scenes/`.
