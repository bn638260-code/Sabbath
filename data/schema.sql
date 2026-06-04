CREATE TABLE IF NOT EXISTS translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    abbreviation TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    language TEXT NOT NULL,
    license TEXT NOT NULL,
    is_copyrighted INTEGER NOT NULL DEFAULT 0,
    is_downloaded INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    translation_id INTEGER NOT NULL REFERENCES translations(id),
    book_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    testament TEXT NOT NULL,
    UNIQUE(translation_id, book_number)
);

CREATE TABLE IF NOT EXISTS verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    translation_id INTEGER NOT NULL REFERENCES translations(id),
    book_id INTEGER NOT NULL REFERENCES books(id),
    book_number INTEGER NOT NULL,
    book_name TEXT NOT NULL,
    book_abbreviation TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verses_lookup ON verses(translation_id, book_number, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_verses_chapter ON verses(translation_id, book_number, chapter);
CREATE UNIQUE INDEX IF NOT EXISTS idx_verses_unique_lookup ON verses(translation_id, book_number, chapter, verse);

CREATE TABLE IF NOT EXISTS cross_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_book INTEGER NOT NULL,
    from_chapter INTEGER NOT NULL,
    from_verse INTEGER NOT NULL,
    to_book INTEGER NOT NULL,
    to_chapter INTEGER NOT NULL,
    to_verse_start INTEGER NOT NULL,
    to_verse_end INTEGER NOT NULL,
    votes INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_crossref_from ON cross_references(from_book, from_chapter, from_verse);
CREATE INDEX IF NOT EXISTS idx_crossref_to ON cross_references(to_book, to_chapter, to_verse_start, to_verse_end);

CREATE TABLE IF NOT EXISTS embedding_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    translation_id INTEGER NOT NULL REFERENCES translations(id),
    model_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    computed_at TEXT,
    UNIQUE(translation_id, model_name)
);

-- Ellen G. White books, addressed by chapter + paragraph (not verse).
CREATE TABLE IF NOT EXISTS egw_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_number INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    chapter_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS egw_paragraphs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL REFERENCES egw_books(id),
    book_number INTEGER NOT NULL,
    book_title TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    chapter_title TEXT NOT NULL,
    paragraph INTEGER NOT NULL,
    text TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_egw_lookup ON egw_paragraphs(book_number, chapter, paragraph);
CREATE INDEX IF NOT EXISTS idx_egw_chapter ON egw_paragraphs(book_number, chapter);
CREATE UNIQUE INDEX IF NOT EXISTS idx_egw_unique ON egw_paragraphs(book_number, chapter, paragraph);
