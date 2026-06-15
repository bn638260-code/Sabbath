//! Speech-to-text integration for the `SabbathCue` application.
//!
//! Provides real-time transcription via multiple providers:
//! - **Deepgram** (cloud): WebSocket streaming with keyword boosting
//! - **Gladia** (cloud): WebSocket streaming via the Gladia live API
//! - **Sherpa** (local): offline streaming via a sherpa-onnx Zipformer worker
//! - **Vosk** (local): offline low-latency streaming via a worker process
//!
//! # Key types
//!
//! - [`SttProvider`]: trait for swappable STT backends
//! - [`DeepgramClient`]: Deepgram WebSocket/REST provider
//! - [`GladiaClient`]: Gladia live WebSocket provider
//! - [`SherpaProvider`]: local sherpa-onnx worker provider
//! - [`TranscriptEvent`]: streaming transcript events
//! - [`SttConfig`]: API configuration
//! - [`SttError`]: error type for STT operations
//!
//! # Feature flags
//!
//! - `rest-fallback`: enables REST API fallback client
//! - `gladia`: enables the Gladia live API provider
//! - `whisper`: enables local Whisper STT provider

pub mod bench;
pub mod deepgram;
pub mod error;
#[cfg(feature = "gladia")]
pub mod gladia;
pub mod keyterms;
pub mod provider;
pub mod rest;
pub mod sherpa;
pub mod types;
pub mod vosk;
pub mod worker;

#[cfg(feature = "faster-whisper")]
pub mod faster_whisper;
#[cfg(feature = "whisper")]
pub mod whisper;

pub use deepgram::DeepgramClient;
pub use error::SttError;
#[cfg(feature = "gladia")]
pub use gladia::GladiaClient;
pub use keyterms::bible_keyterms;
pub use provider::SttProvider;
pub use sherpa::SherpaProvider;
pub use types::{SttConfig, TranscriptEvent, Word};
pub use vosk::VoskProvider;

#[cfg(feature = "faster-whisper")]
pub use faster_whisper::FasterWhisperProvider;
#[cfg(feature = "whisper")]
pub use whisper::WhisperProvider;
