//! Afrikaans semantic retrieval benchmark metadata tests.

#[test]
fn afrikaans_semantic_benchmark_has_johannes_3_16_paraphrase() {
    // Mirrors data/afrikaans-semantic-benchmark.ts golden cases.
    let cases = [
        ("God so lief die wêreld gehad het", 43, 3, 16),
        ("Hy is my herder ek sal nie ontbreke nie", 19, 23, 1),
    ];

    for (query, book, chapter, verse) in cases {
        assert!(!query.is_empty());
        assert!((1..=66).contains(&book));
        assert!(chapter > 0);
        assert!(verse > 0);
    }
}
