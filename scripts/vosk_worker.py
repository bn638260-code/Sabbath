#!/usr/bin/env python3
"""Streaming Vosk worker for SabbathCue.

Reads raw little-endian 16-bit PCM from stdin and emits line-delimited JSON:
{"type":"partial","text":"..."} and {"type":"final","text":"..."}.
"""

from __future__ import annotations

import argparse
import json
import sys


def emit(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--sample-rate", type=int, default=16000)
    parser.add_argument(
        "--grammar-json",
        default=None,
        help="Optional JSON array of domain phrases. Include [unk] to keep open dictation.",
    )
    parser.add_argument(
        "--grammar-json-file",
        default=None,
        help="Path to a UTF-8 file containing the grammar JSON array.",
    )
    args = parser.parse_args()

    if args.grammar_json and args.grammar_json_file:
        emit(
            {
                "type": "error",
                "message": "Use only one of --grammar-json or --grammar-json-file",
            }
        )
        return 1

    grammar_json = args.grammar_json
    if args.grammar_json_file:
        try:
            with open(args.grammar_json_file, encoding="utf-8") as grammar_file:
                grammar_json = grammar_file.read()
        except OSError as exc:
            emit(
                {
                    "type": "error",
                    "message": f"Could not read grammar file {args.grammar_json_file}: {exc}",
                }
            )
            return 1

        if grammar_json.strip():
            try:
                json.loads(grammar_json)
            except json.JSONDecodeError as exc:
                emit(
                    {
                        "type": "error",
                        "message": f"Grammar file contains invalid JSON: {exc}",
                    }
                )
                return 1

    try:
        from vosk import KaldiRecognizer, Model
    except Exception as exc:
        emit({"type": "error", "message": f"Python package 'vosk' is not installed: {exc}"})
        return 1

    try:
        model = Model(args.model)
        if grammar_json:
            recognizer = KaldiRecognizer(model, args.sample_rate, grammar_json)
        else:
            recognizer = KaldiRecognizer(model, args.sample_rate)
        recognizer.SetWords(True)
        recognizer.SetPartialWords(True)
        emit({"type": "ready"})

        # 35 ms of 16 kHz 16-bit mono PCM. This keeps live preview latency low
        # while giving Vosk a little more context per pass. The Rust side writes
        # the same chunk size; this worker emits partials as soon as Vosk has useful text.
        chunk_bytes = 1120

        while True:
            chunk = sys.stdin.buffer.read(chunk_bytes)
            if not chunk:
                break
            if recognizer.AcceptWaveform(chunk):
                result = json.loads(recognizer.Result())
                text = (result.get("text") or "").strip()
                if text:
                    emit(
                        {
                            "type": "final",
                            "text": text,
                            "words": result.get("result") or [],
                        }
                    )
            else:
                partial = json.loads(recognizer.PartialResult())
                text = (partial.get("partial") or "").strip()
                if text:
                    emit(
                        {
                            "type": "partial",
                            "text": text,
                            "words": partial.get("partial_result") or [],
                        }
                    )

        final = json.loads(recognizer.FinalResult())
        text = (final.get("text") or "").strip()
        if text:
            emit({"type": "final", "text": text, "words": final.get("result") or []})
    except Exception as exc:
        emit({"type": "error", "message": f"Vosk worker failed: {exc}"})
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
