//! Regressions distilled from a real live-sermon transcript (Daniel /
//! "God's sovereignty" sermon). The preacher cites references the way real
//! preachers do: "Daniel chapter one", long commentary, then "read verse 2",
//! later a bare "Chapter 2, verse 37" with no book name at all.

use rhema_detection::DirectDetector;

/// Live auto-fire threshold used by the app.
const LIVE_THRESHOLD: f64 = 0.90;

#[test]
fn explicit_spoken_chapter_only_reaches_live_threshold() {
    let mut detector = DirectDetector::new();

    let detections =
        detector.detect("In Daniel chapter one, by the way, now I want us to look at this text.");

    let daniel = detections
        .iter()
        .find(|d| d.verse_ref.book_name == "Daniel")
        .expect("spoken 'Daniel chapter one' must surface a chapter-only detection");
    assert_eq!(daniel.verse_ref.chapter, 1);
    assert!(daniel.is_chapter_only);
    assert!(
        daniel.confidence >= LIVE_THRESHOLD,
        "an explicitly spoken chapter reference is a direct citation and must go live \
         (got {:.2})",
        daniel.confidence
    );
}

#[test]
fn daniel_reading_flow_verse_continuation_still_completes() {
    // The fast path: "Daniel chapter one" ... commentary ... "read verse 2"
    // within the incomplete-reference window.
    let mut detector = DirectDetector::new();

    detector.detect("In Daniel chapter one, by the way, now I want us to look at this text.");
    detector.detect(
        "In the third year of the reign of Joachim, king of Judah came Nebuchadnezzar, \
         king of Babylon, unto Jerusalem, and besieged it.",
    );
    detector.detect(
        "This is around 605, 606 BC, and so the record says, and they came and besieged it.",
    );
    let detections = detector.detect(
        "Read verse 2. So you've seen human responsibility, what men could do, their choices. \
         Listen to verse 2. And the Lord gave Joachim, king of Judah, into his hand.",
    );

    let daniel = detections
        .iter()
        .find(|d| d.verse_ref.book_name == "Daniel")
        .expect("'read verse 2' after 'Daniel chapter one' must resolve to Daniel 1:2");
    assert_eq!(daniel.verse_ref.chapter, 1);
    assert_eq!(daniel.verse_ref.verse_start, 2);
}

#[test]
fn bare_verse_reference_resolves_from_context_after_full_citation() {
    // A full citation ("Daniel 3:15") clears the incomplete-reference state.
    // A later bare "Verse 27" (no book anywhere in the fragment) must still
    // resolve from the reference context as a *conservative* candidate:
    // visible to the operator, below the auto-fire threshold.
    let mut detector = DirectDetector::new();

    detector.detect("Now, Daniel 3:15, can you read that one?");
    let detections = detector.detect(
        "Verse 27. Remember we read it? Verse 27. Therefore, O king, let my counsel be \
         acceptable unto thee.",
    );

    let daniel = detections
        .iter()
        .find(|d| d.verse_ref.book_name == "Daniel")
        .expect("bare 'verse 27' with recent Daniel context must surface a candidate");
    assert_eq!(daniel.verse_ref.chapter, 3);
    assert_eq!(daniel.verse_ref.verse_start, 27);
    assert!(
        daniel.confidence < LIVE_THRESHOLD,
        "book/chapter were inferred, not spoken — must not auto-fire (got {:.2})",
        daniel.confidence
    );
    assert!(
        daniel.confidence >= 0.70,
        "context-resolved citation should still be a visible candidate (got {:.2})",
        daniel.confidence
    );
}

#[test]
fn bare_chapter_verse_reference_resolves_book_from_context() {
    // "Chapter 2, verse 37" spoken with no book name: the book comes from
    // context (the sermon's active book), chapter/verse are explicit.
    let mut detector = DirectDetector::new();

    detector.detect("Now, Daniel 3:15, can you read that one?");
    let detections =
        detector.detect("Chapter 2, verse 37, the Bible says, you O king are the king of kings.");

    let daniel = detections
        .iter()
        .find(|d| d.verse_ref.book_name == "Daniel")
        .expect("bare 'chapter 2 verse 37' with recent Daniel context must surface a candidate");
    assert_eq!(daniel.verse_ref.chapter, 2);
    assert_eq!(daniel.verse_ref.verse_start, 37);
    assert!(
        daniel.confidence < LIVE_THRESHOLD,
        "book was inferred, not spoken — must not auto-fire (got {:.2})",
        daniel.confidence
    );
}

#[test]
fn bare_verse_reference_without_any_context_stays_silent() {
    let mut detector = DirectDetector::new();

    let detections = detector.detect("Verse 27. Remember we read it? Verse 27.");

    assert!(
        detections.is_empty(),
        "bare 'verse 27' with no prior context must not fabricate a reference"
    );
}

#[test]
fn prose_numbers_do_not_become_context_resolved_references() {
    // Ordinary numbers in commentary after a citation must not turn into
    // verse candidates ("This is around 605, 606 BC", "Start at four").
    let mut detector = DirectDetector::new();

    detector.detect("Now, Daniel 3:15, can you read that one?");
    let bc = detector.detect(
        "This is around 605, 606 BC, and so the record says, and they came and besieged it.",
    );
    let start_at_four = detector
        .detect("Don't read it from one, two, three, you're going to get lost. Start at four.");

    assert!(
        bc.is_empty(),
        "prose numbers must not resolve into context references: {bc:?}"
    );
    assert!(
        start_at_four.is_empty(),
        "prose numbers must not resolve into context references: {start_at_four:?}"
    );
}
