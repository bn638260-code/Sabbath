use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Translation {
    pub id: i64,
    pub abbreviation: String,
    pub title: String,
    pub language: String,
    pub is_copyrighted: bool,
    pub is_downloaded: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Book {
    pub id: i64,
    pub translation_id: i64,
    pub book_number: i32,
    pub name: String,
    pub abbreviation: String,
    pub testament: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Verse {
    pub id: i64,
    pub translation_id: i64,
    pub book_number: i32,
    pub book_name: String,
    pub book_abbreviation: String,
    pub chapter: i32,
    pub verse: i32,
    pub text: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CrossReference {
    pub from_ref: String,
    pub to_ref: String,
    pub votes: i32,
}

/// A compact verse row used for client-side search indexing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SearchVerse {
    pub book_number: i32,
    pub book_name: String,
    pub chapter: i32,
    pub verse: i32,
    pub text: String,
}

/// An Ellen G. White book (e.g. "Patriarchs and Prophets").
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EgwBook {
    pub id: i64,
    pub book_number: i32,
    pub title: String,
    pub abbreviation: String,
    pub chapter_count: i32,
}

/// A single paragraph within an EGW book, addressed by chapter + paragraph.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EgwParagraph {
    pub id: i64,
    pub book_number: i32,
    pub book_title: String,
    pub chapter: i32,
    pub chapter_title: String,
    pub paragraph: i32,
    pub text: String,
}

/// Chapter metadata for an EGW book (for chapter navigation).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EgwChapterInfo {
    pub chapter: i32,
    pub title: String,
    pub paragraph_count: i32,
}
