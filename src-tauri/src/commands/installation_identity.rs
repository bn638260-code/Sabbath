use std::fmt::Write as _;

use base64::Engine as _;
use p256::ecdsa::{signature::Signer, Signature, SigningKey};
use p256::elliptic_curve::rand_core::OsRng;
use p256::pkcs8::{DecodePrivateKey, EncodePrivateKey, EncodePublicKey};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::command;

use super::secrets::{KeychainStore, RealKeychainStore};

const PRIVATE_KEY_ENTRY: &str = "installation_identity_private_key_v1";
const DEVICE_ID_ENTRY: &str = "installation_identity_device_id_v1";
static DEFAULT_STORE: RealKeychainStore = RealKeychainStore;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallationIdentity {
    pub device_id: String,
    pub public_key: String,
}

fn encode_private_key(key: &SigningKey) -> Result<String, String> {
    let document = key
        .to_pkcs8_der()
        .map_err(|error| format!("Could not encode installation identity: {error}"))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(document.as_bytes()))
}

fn decode_private_key(value: &str) -> Result<SigningKey, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(value)
        .map_err(|error| format!("Stored installation identity is invalid: {error}"))?;
    SigningKey::from_pkcs8_der(&bytes)
        .map_err(|error| format!("Stored installation identity is invalid: {error}"))
}

fn load_or_create_signing_key(store: &dyn KeychainStore) -> Result<SigningKey, String> {
    match store.get_password(PRIVATE_KEY_ENTRY) {
        Ok(value) => decode_private_key(&value),
        Err(keyring::Error::NoEntry) => {
            let key = SigningKey::random(&mut OsRng);
            let encoded = encode_private_key(&key)?;
            store
                .set_password(PRIVATE_KEY_ENTRY, &encoded)
                .map_err(|error| {
                    format!("Could not store installation identity in OS keychain: {error}")
                })?;
            Ok(key)
        }
        Err(error) => Err(format!(
            "Could not read installation identity from OS keychain: {error}"
        )),
    }
}

fn public_key_for(key: &SigningKey) -> Result<(Vec<u8>, String), String> {
    let public_document = key
        .verifying_key()
        .to_public_key_der()
        .map_err(|error| format!("Could not encode installation public key: {error}"))?;
    let public_bytes = public_document.as_bytes();
    let digest = Sha256::digest(public_bytes);
    let mut device_id = String::with_capacity(digest.len() * 2);
    for byte in digest {
        write!(&mut device_id, "{byte:02x}")
            .map_err(|error| format!("Could not derive installation ID: {error}"))?;
    }
    Ok((public_bytes.to_vec(), device_id))
}

fn load_or_create_device_id(store: &dyn KeychainStore, key: &SigningKey) -> Result<String, String> {
    match store.get_password(DEVICE_ID_ENTRY) {
        Ok(value) if !value.trim().is_empty() => Ok(value),
        Ok(_) | Err(keyring::Error::NoEntry) => {
            let (_, device_id) = public_key_for(key)?;
            store
                .set_password(DEVICE_ID_ENTRY, &device_id)
                .map_err(|error| {
                    format!("Could not store installation ID in OS keychain: {error}")
                })?;
            Ok(device_id)
        }
        Err(error) => Err(format!(
            "Could not read installation ID from OS keychain: {error}"
        )),
    }
}

#[command]
pub fn get_or_create_installation_identity() -> Result<InstallationIdentity, String> {
    get_or_create_installation_identity_with_store(&DEFAULT_STORE)
}

pub fn get_or_create_installation_identity_with_store(
    store: &dyn KeychainStore,
) -> Result<InstallationIdentity, String> {
    let key = load_or_create_signing_key(store)?;
    let (public_bytes, _) = public_key_for(&key)?;
    Ok(InstallationIdentity {
        device_id: load_or_create_device_id(store, &key)?,
        public_key: base64::engine::general_purpose::STANDARD.encode(public_bytes),
    })
}

#[command]
#[expect(
    clippy::needless_pass_by_value,
    reason = "Tauri command extractors require pass-by-value"
)]
pub fn adopt_installation_device_id(device_id: String) -> Result<(), String> {
    adopt_installation_device_id_with_store(&DEFAULT_STORE, &device_id)
}

pub fn adopt_installation_device_id_with_store(
    store: &dyn KeychainStore,
    device_id: &str,
) -> Result<(), String> {
    if device_id.trim().is_empty() {
        return Err("Installation ID cannot be empty".into());
    }
    match store.get_password(DEVICE_ID_ENTRY) {
        Ok(existing) if !existing.trim().is_empty() => Ok(()),
        Ok(_) | Err(keyring::Error::NoEntry) => store
            .set_password(DEVICE_ID_ENTRY, device_id)
            .map_err(|error| format!("Could not preserve installation ID: {error}")),
        Err(error) => Err(format!("Could not read installation ID: {error}")),
    }
}

#[command]
#[expect(
    clippy::needless_pass_by_value,
    reason = "Tauri command extractors require pass-by-value"
)]
pub fn sign_installation_challenge(challenge: String) -> Result<String, String> {
    sign_installation_challenge_with_store(&DEFAULT_STORE, &challenge)
}

pub fn sign_installation_challenge_with_store(
    store: &dyn KeychainStore,
    challenge: &str,
) -> Result<String, String> {
    if challenge.is_empty() {
        return Err("Installation challenge cannot be empty".into());
    }
    let key = load_or_create_signing_key(store)?;
    let signature: Signature = key.sign(challenge.as_bytes());
    Ok(base64::engine::general_purpose::STANDARD.encode(signature.to_bytes()))
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::sync::Mutex;

    use p256::ecdsa::{signature::Verifier, Signature, VerifyingKey};
    use p256::pkcs8::DecodePublicKey;

    use super::*;

    struct MemoryKeychain {
        values: Mutex<HashMap<String, String>>,
    }

    impl MemoryKeychain {
        fn new() -> Self {
            Self {
                values: Mutex::new(HashMap::new()),
            }
        }
    }

    impl KeychainStore for MemoryKeychain {
        fn get_password(&self, name: &str) -> Result<String, keyring::Error> {
            self.values
                .lock()
                .map_err(|_| {
                    keyring::Error::PlatformFailure(Box::new(std::io::Error::other("lock")))
                })?
                .get(name)
                .cloned()
                .ok_or(keyring::Error::NoEntry)
        }

        fn set_password(&self, name: &str, password: &str) -> Result<(), keyring::Error> {
            self.values
                .lock()
                .map_err(|_| {
                    keyring::Error::PlatformFailure(Box::new(std::io::Error::other("lock")))
                })?
                .insert(name.to_string(), password.to_string());
            Ok(())
        }

        fn delete_password(&self, name: &str) -> Result<(), keyring::Error> {
            self.values
                .lock()
                .map_err(|_| {
                    keyring::Error::PlatformFailure(Box::new(std::io::Error::other("lock")))
                })?
                .remove(name);
            Ok(())
        }
    }

    #[test]
    fn identity_is_stable_for_the_same_keychain() {
        let store = MemoryKeychain::new();
        let first = get_or_create_installation_identity_with_store(&store).unwrap();
        let second = get_or_create_installation_identity_with_store(&store).unwrap();
        assert_eq!(first.device_id, second.device_id);
        assert_eq!(first.public_key, second.public_key);
    }

    #[test]
    fn signature_verifies_with_the_returned_public_key() {
        let store = MemoryKeychain::new();
        let identity = get_or_create_installation_identity_with_store(&store).unwrap();
        let encoded = sign_installation_challenge_with_store(&store, "challenge-1").unwrap();
        let public_der = base64::engine::general_purpose::STANDARD
            .decode(identity.public_key)
            .unwrap();
        let signature_der = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .unwrap();
        let verifying_key = VerifyingKey::from_public_key_der(&public_der).unwrap();
        let signature = Signature::from_slice(&signature_der).unwrap();
        assert!(verifying_key.verify(b"challenge-1", &signature).is_ok());
    }

    #[test]
    fn legacy_device_id_is_preserved_in_the_keychain() {
        let store = MemoryKeychain::new();
        adopt_installation_device_id_with_store(&store, "legacy-device-id").unwrap();
        let identity = get_or_create_installation_identity_with_store(&store).unwrap();
        assert_eq!(identity.device_id, "legacy-device-id");
    }
}
