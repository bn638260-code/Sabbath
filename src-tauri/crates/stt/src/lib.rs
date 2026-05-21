//! Speech-to-text integration for the `SabbathCue` application.
//!
//! Provides real-time transcription via multiple providers:
//! - **Deepgram** (cloud) — WebSocket streaming with keyword boosting
//! - **Whisper** (local) — offline inference via whisper.cpp
//! - **faster-whisper** (local) — offline inference via Python/CTranslate2
//!
//! # Key types
//!
//! - [`SttProvider`] — trait for swappable STT backends
//! - [`DeepgramClient`] — Deepgram WebSocket/REST provider
//! - [`TranscriptEvent`] — streaming transcript events (partial, final, etc.)
//! - [`SttConfig`] — API configuration
//! - [`SttError`] — error type for STT operations
//!
//! # Feature flags
//!
//! - `rest-fallback` — enables REST API fallback client
//! - `whisper` — enables local Whisper STT provider
//! - `faster-whisper` — enables local faster-whisper/CTranslate2 provider

pub mod bench;
pub mod deepgram;
pub mod error;
pub mod keyterms;
pub mod provider;
pub mod rest;
pub mod types;

#[cfg(feature = "faster-whisper")]
pub mod faster_whisper;
#[cfg(feature = "whisper")]
pub mod whisper;

pub use deepgram::DeepgramClient;
pub use error::SttError;
pub use keyterms::bible_keyterms;
pub use provider::SttProvider;
pub use types::{SttConfig, TranscriptEvent, Word};

#[cfg(feature = "faster-whisper")]
pub use faster_whisper::FasterWhisperProvider;
#[cfg(feature = "whisper")]
pub use whisper::WhisperProvider;
