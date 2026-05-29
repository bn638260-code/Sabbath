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

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::sync::Mutex;

    fn test_db() -> BibleDb {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE cross_references (from_book INTEGER, from_chapter INTEGER, from_verse INTEGER, to_book INTEGER, to_chapter INTEGER, to_verse_start INTEGER, to_verse_end INTEGER, votes INTEGER);\
             INSERT INTO cross_references VALUES (1,1,1, 43,3,16,16, 5);\
             INSERT INTO cross_references VALUES (1,1,1, 19,33,6,9, 12);",
        )
        .unwrap();
        BibleDb {
            conn: Mutex::new(conn),
        }
    }

    #[test]
    fn orders_by_votes_desc_and_formats_ranges() {
        let db = test_db();
        let refs = db.get_cross_references(1, 1, 1).unwrap();
        assert_eq!(refs.len(), 2);
        assert_eq!(refs[0].votes, 12);
        assert_eq!(refs[0].to_ref, "19:33:6-9");
        assert_eq!(refs[1].to_ref, "43:3:16");
    }

    #[test]
    fn empty_when_no_match() {
        let db = test_db();
        assert!(db.get_cross_references(2, 2, 2).unwrap().is_empty());
    }
}
