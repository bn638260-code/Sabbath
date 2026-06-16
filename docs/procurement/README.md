# SabbathCue Vendor Packet

**Product:** SabbathCue - AI-assisted worship presentation software  
**Version:** 0.1.3  
**Prepared:** 2026-05-24

## Purpose

This packet provides evidence for organizations evaluating SabbathCue for
purchase and deployment. It covers the security posture, data handling
practices, software supply chain, and operational requirements.

## Contents

| Document                                                      | Description                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| [Security Overview](./security-overview.md)                   | Architecture, CSP, remote control defaults, vulnerability reporting |
| [Privacy & Data Flow](./privacy-data-flow.md)                 | Data inventory, network flows, retention, third-party dependencies  |
| [Release Security Checklist](./release-security-checklist.md) | Automated CI gates, manual verification steps, artifact evidence    |

## Software supply chain

SabbathCue is built on:

- **Frontend**: React 19, Vite 7, Tailwind CSS, Zustand
- **Backend**: Rust workspace of 6 crates, Tauri v2
- **STT**: Local Whisper (default), optional Deepgram (Vosk retained for compatibility)
- **ML**: ONNX Runtime, Qwen3-0.6B embeddings
- **Database**: SQLite
- **Broadcast**: NDI 6 SDK, dynamically loaded

Direct dependencies are checked per release with `cargo deny` and
`npm audit`. Release builds generate a CycloneDX SBOM artifact.

## Deployment model

- **Installation**: Single Windows installer (`.msi` or `.exe`)
- **Network**: No internet required for core operation when using local Whisper STT and bundled local data
- **Internet needed for**: Deepgram cloud STT (opt-in), setup-time downloads, and optional NDI SDK download
- **Admin rights**: Not required for normal operation
- **Updates**: Manual download of new installer; no auto-update mechanism

## Key security claims

1. **No telemetry**: The app does not include analytics, crash reporting, or usage tracking.
2. **Local-first**: Whisper speech recognition runs locally; the Bible database is local SQLite.
3. **Loopback-only remote control**: OSC and HTTP listeners bind `127.0.0.1` by default, with bearer-token auth on HTTP control endpoints.
4. **Restrictive CSP**: WebView runs with `script-src 'self'` only; no inline scripts.
5. **Keychain-backed secrets**: API keys and tokens are stored through the OS keychain, never plaintext on disk.

## Certification status

SabbathCue has **not** undergone formal SOC 2, ISO 27001, or FedRAMP
certification. This packet provides self-attested evidence for buyers
to conduct their own security evaluation. Pull-request and main-branch
CI run lint, typecheck, unit tests, builds, dependency checks, and Rust
Clippy. Release builds additionally generate SBOM and checksum artifacts.

## Contact

For procurement questions or security inquiries, follow the responsible
disclosure process in [SECURITY.md](https://github.com/BongaNdlovu/SabbathCue/blob/main/.github/SECURITY.md).
