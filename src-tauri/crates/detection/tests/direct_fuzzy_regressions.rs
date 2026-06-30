use rhema_detection::DirectDetector;

#[test]
fn singular_plural_book_variants_still_detect_through_direct_detector() {
    let mut detector = DirectDetector::new();

    let hebrews = detector.detect("read Hebrew 11");
    assert!(
        hebrews
            .iter()
            .any(|detection| detection.verse_ref.book_name == "Hebrews"),
        "singular Hebrew should recover Hebrews"
    );

    let romans = detector.detect("turn to Roman 8");
    assert!(
        romans
            .iter()
            .any(|detection| detection.verse_ref.book_name == "Romans"),
        "singular Roman should recover Romans"
    );
}

#[test]
fn prose_number_still_does_not_fabricate_numbers_reference() {
    let mut detector = DirectDetector::new();

    let detections = detector.detect("who's the number 1 in the room");

    assert!(
        detections
            .iter()
            .all(|detection| detection.verse_ref.book_name != "Numbers"),
        "ordinary number prose must not fuzzy-match Numbers"
    );
}

#[test]
fn daniel_seven_ten_number_prose_does_not_fabricate_numbers_reference() {
    let mut detector = DirectDetector::new();

    let detections = detector.detect(
        "a fiery stream issued and came forth from before him a thousand thousands ministered to him ten thousand times ten thousand stood before him",
    );

    assert!(
        detections
            .iter()
            .all(|detection| detection.verse_ref.book_name != "Numbers"),
        "Daniel 7:10 number prose must not fabricate Numbers"
    );
}
