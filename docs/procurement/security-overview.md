# SabbathCue Security Overview

**Version:** 0.1.3  
**Last updated:** 2026-05-24  
**Classification:** Vendor Packet - Public

## Architecture

SabbathCue is a Tauri v2 desktop application combining a React frontend
(WebView) with a Rust backend. The WebView runs under a restrictive Content
Security Policy. External network traffic, when enabled, originates from the
Rust side rather than browser-side JavaScript.

### Key security properties

| Property            | Implementation                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------- |
| No telemetry        | No analytics, crash reporting, or usage tracking pipeline                                |
| Local-first STT     | Whisper runs locally in-process (default); audio stays on the machine                    |
| Bundled SQLite      | `rusqlite` with the `bundled` feature avoids system SQLite dependency drift              |
| Remote control      | Loopback-only by default (`127.0.0.1`); HTTP control endpoints require bearer token auth |
| CSP enforcement     | `script-src 'self'` only; no inline scripts or eval                                      |
| Secrets storage     | API keys and tokens stored with the Rust `keyring` crate using OS keychain facilities    |
| Dynamic NDI loading | NDI SDK loaded dynamically; app can run without NDI installed                            |

### Content Security Policy

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self' data:;
connect-src 'self';
media-src 'self' blob:;
worker-src 'self';
frame-src 'none';
frame-ancestors 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
manifest-src 'self'
```

- `script-src 'self'` prevents inline scripts, `eval`, and third-party JavaScript.
- `style-src 'self' 'unsafe-inline'` is required by the current React/Tailwind/Radix styling path.
- `connect-src 'self'` keeps the WebView from initiating arbitrary external fetch/WebSocket traffic.
- `frame-ancestors 'none'` prevents embedding.

### Remote control defaults

- **OSC listener**: binds `127.0.0.1:8000` by default.
- **HTTP listener**: binds `127.0.0.1:8080` by default.
- **HTTP auth**: private HTTP endpoints require `Authorization: Bearer <token>`.
- **Token storage**: the HTTP bearer token is generated locally, stored in the OS keychain, and rotatable from Settings -> Remote.

LAN exposure is not currently enabled through the UI. Any future LAN mode should be an explicit opt-in feature with authentication, clear operator warnings, and firewall guidance.

### Vulnerability reporting

See [.github/SECURITY.md](https://github.com/BongaNdlovu/SabbathCue/blob/main/.github/SECURITY.md) for the responsible disclosure process.
