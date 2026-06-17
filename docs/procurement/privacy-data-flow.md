# SabbathCue Privacy & Data Flow

**Version:** 0.1.3  
**Last updated:** 2026-05-24

## Data inventory

| Data type         | Storage location                                            | Network transmission                                                   | Notes                                                           |
| ----------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| Audio input       | RAM only                                                    | None in local Vosk mode / Deepgram or Gladia cloud mode                | Not intentionally written to disk by the app                    |
| Transcripts       | RAM and UI state during the active session                  | None in local Vosk mode / cloud STT response stream                    | Cleared through transcript/session controls or app close        |
| Bible database    | Bundled `rhema.db` resource, or development `data/rhema.db` | None during normal app operation                                       | Built during setup/release from source data                     |
| Deepgram API key  | OS keychain                                                 | Sent to Deepgram only when Deepgram mode is used                       | Never intentionally stored in plaintext app settings            |
| HTTP bearer token | OS keychain                                                 | Sent by local clients in the `Authorization` header over loopback HTTP | Generated locally; used to authenticate remote-control requests |
| Service plans     | Local app data/settings storage                             | None                                                                   | User-created local files/data                                   |
| Settings          | Local app data/settings storage                             | None                                                                   | Includes non-secret preferences                                 |
| Detection models  | App resources or local `models/` directory                  | None during normal operation                                           | ONNX and Vosk model files run locally                           |
| Embeddings        | App resources or local `embeddings/` directory              | None during normal operation                                           | Pre-computed verse vectors                                      |

## Network flows

### No network (local Vosk mode, default)

- Audio -> local Vosk worker -> transcript -> UI
- No outbound STT traffic

### Cloud STT modes (opt-in)

- Audio -> Deepgram WebSocket (`wss://api.deepgram.com`) -> transcript -> UI
- REST fallback may upload buffered audio windows if WebSocket transcription fails
- Requires a Deepgram API key stored in the OS keychain
- Audio -> Gladia live session (`https://api.gladia.io`) -> transcript -> UI
- Requires a Gladia API key stored in the OS keychain

### Setup-time downloads

- Bible source data, ML models, the Vosk STT model, and the optional NDI SDK may be downloaded during setup or release preparation.
- These downloads are not part of normal local operation after assets are installed.

### Remote control (loopback only by default)

- OSC: UDP on `127.0.0.1:8000`
- HTTP: TCP on `127.0.0.1:8080` with bearer-token authentication for private endpoints
- Remote-control traffic is local inbound traffic unless a future LAN opt-in feature changes the bind host

## Data retention

- Audio: held in memory during active transcription
- Transcripts: held in application state for the active session
- Service plans and settings: persisted locally until removed by the user or application cleanup
- API keys and HTTP tokens: persisted in the OS keychain until removed or rotated
- No server-side SabbathCue storage, cloud sync, analytics database, or telemetry pipeline

## Third-party dependencies

| Dependency   | Purpose                | Data shared                                              |
| ------------ | ---------------------- | -------------------------------------------------------- |
| Vosk         | Local worker STT       | Audio stays on the local machine                         |
| Deepgram     | Optional cloud STT     | Audio stream and API key when enabled                    |
| Gladia       | Optional cloud STT     | Audio stream and API key when enabled                    |
| LibreOffice  | Optional PPTX-to-PDF   | Deck file stays on the local machine                     |
| ONNX Runtime | Local ML inference     | None                                                     |
| SQLite       | Local Bible database   | None                                                     |
| NDI SDK      | Video broadcast output | Video frames to configured local/broadcast NDI consumers |

## Compliance notes

- **GDPR**: SabbathCue is local-first and does not operate a cloud account system or telemetry backend.
- **HIPAA**: Not applicable; SabbathCue is not a healthcare application.
- **SOC 2**: Not certified; this document provides self-attested evidence for buyer evaluation.
