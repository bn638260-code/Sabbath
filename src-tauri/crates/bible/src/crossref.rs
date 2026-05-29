use crate::db::BibleDb;
use crate::error::BibleError;
use crate::models::CrossReference;

impl BibleDb {
    /// # Panics
    ///
    /// Panics if the internal mutex is poisoned (i.e., a thread panicked
    /// while holding the database lock).
    pub fn get_cross_references(
        &self,
        book_number: i32,
        chapter: i32,
        verse: i32,
    ) -> Result<Vec<CrossReference>, BibleError> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT \
                 from_book || ':' || from_chapter || ':' || from_verse AS from_ref, \
                 to_book || ':' || to_chapter || ':' || to_verse_start || \
                     CASE WHEN to_verse_end > to_verse_start \
                          THEN '-' || to_verse_end ELSE '' END AS to_ref, \
                 votes \
             FROM cross_references \
             WHERE from_book = ?1 AND from_chapter = ?2 AND from_verse = ?3 \
             ORDER BY votes DESC",
        )?;
        let rows = stmt.query_map(
            rusqlite::params![book_number, chapter, verse],
            |row: &rusqlite::Row| {
                Ok(CrossReference {
                    from_ref: row.get(0)?,
                    to_ref: row.get(1)?,
                    votes: row.get(2)?,
                })
            },
        )?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }
}
