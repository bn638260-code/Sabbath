#![expect(
    clippy::needless_pass_by_value,
    reason = "Tauri command extractors require pass-by-value"
)]

use std::sync::Mutex;
use tauri::State;

use crate::state::AppState;
use super::validation::{bounded_limit, bounded_text, MAX_QUERY_BYTES};
use rhema_bible::{BibleDb, BibleError, EgwBook, EgwChapterInfo, EgwParagraph};

fn with_db<T>(
    state: &State<'_, Mutex<AppState>>,
    f: impl FnOnce(&BibleDb) -> Result<T, BibleError>,
) -> Result<T, String> {
    let app_state = state.lock().map_err(|e| e.to_string())?;
    let db = app_state
        .bible_db
        .as_ref()
        .ok_or_else(|| "Bible database not loaded".to_string())?;
    f(db).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn egw_list_books(state: State<'_, Mutex<AppState>>) -> Result<Vec<EgwBook>, String> {
    with_db(&state, BibleDb::list_egw_books)
}

#[tauri::command]
pub fn egw_list_chapters(
    state: State<'_, Mutex<AppState>>,
    book_number: i32,
) -> Result<Vec<EgwChapterInfo>, String> {
    with_db(&state, |db| db.list_egw_chapters(book_number))
}

#[tauri::command]
pub fn egw_get_chapter(
    state: State<'_, Mutex<AppState>>,
    book_number: i32,
    chapter: i32,
) -> Result<Vec<EgwParagraph>, String> {
    with_db(&state, |db| db.get_egw_chapter(book_number, chapter))
}

#[tauri::command]
pub fn egw_get_paragraph(
    state: State<'_, Mutex<AppState>>,
    book_number: i32,
    chapter: i32,
    paragraph: i32,
) -> Result<Option<EgwParagraph>, String> {
    with_db(&state, |db| {
        db.get_egw_paragraph(book_number, chapter, paragraph)
    })
}

#[tauri::command]
pub fn egw_search(
    state: State<'_, Mutex<AppState>>,
    query: String,
    limit: usize,
) -> Result<Vec<EgwParagraph>, String> {
    bounded_text(&query, "query", MAX_QUERY_BYTES)?;
    let limit = bounded_limit(limit)?;
    with_db(&state, |db| db.search_egw(&query, limit))
}
