//! Speech-to-text integration for the `SabbathCue` application.
//!
//! Provides real-time transcription via multiple providers:
//! - **Deepgram** (cloud): WebSocket streaming with keyword boosting
//! - **Gladia** (cloud): WebSocket streaming via the Gladia live API
//! - **Vosk** (local): offline compatibility provider via a worker process
//!
//! # Key types
//!
//! - [`SttProvider`]: trait for swappable STT backends
//! - [`DeepgramClient`]: Deepgram WebSocket/REST provider
//! - [`GladiaClient`]: Gladia live WebSocket provider
//! - [`TranscriptEvent`]: streaming transcript events
//! - [`SttConfig`]: API configuration
//! - [`SttError`]: error type for STT operations
//!
//! # Feature flags
//!
//! - `rest-fallback`: enables REST API fallback client
//! - `gladia`: enables the Gladia live API provider

pub mod bench;
pub mod deepgram;
pub mod error;
#[cfg(feature = "gladia")]
pub mod gladia;
pub mod keyterms;
pub mod provider;
pub mod rest;
pub mod types;
pub mod vosk;
pub mod worker;

pub use deepgram::DeepgramClient;
pub use error::SttError;
#[cfg(feature = "gladia")]
pub use gladia::GladiaClient;
pub use keyterms::bible_keyterms;
pub use provider::SttProvider;
pub use types::{SttConfig, TranscriptEvent, Word};
pub use vosk::VoskProvider;
