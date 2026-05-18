# SabbathCue Desktop Release Checklist

## Free Public Installer Rules

- [ ] Installer includes only public-domain/default redistributable Bible translations.
- [ ] Installer does not include NIV, ESV, NASB, NKJV, NLT, or AMP unless written redistribution permission exists.
- [ ] Installer does not include NDI SDK/runtime binaries.
- [ ] App launches without `.env`.
- [ ] Default STT provider is local Whisper.
- [ ] Deepgram is labeled optional paid cloud mode.
- [ ] HTTP and OSC remote control bind to localhost by default.
- [ ] Packaged app is tested outside the source repository.

## Build

- [ ] `bun install`
- [ ] `bun run build:bible:public`
- [ ] `bun run typecheck`
- [ ] `bun test`
- [ ] `bun run build`
- [ ] `cargo check --workspace`
- [ ] `cargo test --workspace`
- [ ] `bun run tauri build`

## Clean Machine Smoke Test

- [ ] App opens.
- [ ] Bible translations load.
- [ ] Manual search works.
- [ ] Preview changes when selecting verses.
- [ ] Live output only changes when presenting.
- [ ] Settings persist after restart.
- [ ] Whisper missing state is clear.
- [ ] Deepgram key is optional.
- [ ] HTTP remote starts on localhost.
- [ ] NDI missing state is clear and non-fatal.
