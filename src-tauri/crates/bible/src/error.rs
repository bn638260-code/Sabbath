use thiserror::Error;

#[non_exhaustive]
#[derive(Debug, Error)]
pub enum BibleError {
    #[error("database error: {0}")]
    DatabaseError(#[from] rusqlite::Error),

    #[error("internal error: {0}")]
    Internal(String),
}
