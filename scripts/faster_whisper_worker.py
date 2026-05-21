#!/usr/bin/env python3
"""Line-oriented faster-whisper worker for SabbathCue.

Reads JSON lines from stdin:
  {"id": 1, "samples_b64": "..."}

Writes JSON lines to stdout:
  {"id": 1, "text": "...", "segments": [{"text": "...", "start": 0.0, "end": 1.2}]}
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
from typing import Any


PROMPT = (
    "Sermon and Bible reading transcription. Spell Bible references and book "
    "names exactly. Common Bible words: Jesus, Christ, God, Lord, Holy Spirit, "
    "Genesis, Exodus, Leviticus, Numbers, Deuteronomy, Joshua, Judges, Ruth, "
    "Samuel, Kings, Chronicles, Ezra, Nehemiah, Esther, Job, Psalms, Proverbs, "
    "Ecclesiastes, Song of Solomon, Isaiah, Jeremiah, Lamentations, Ezekiel, "
    "Daniel, Hosea, Joel, Amos, Obadiah, Jonah, Micah, Nahum, Habakkuk, "
    "Zephaniah, Haggai, Zechariah, Malachi, Matthew, Mark, Luke, John, Acts, "
    "Romans, Corinthians, Galatians, Ephesians, Philippians, Colossians, "
    "Thessalonians, Timothy, Titus, Philemon, Hebrews, James, Peter, Jude, "
    "Revelation."
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="large-v3-turbo")
    parser.add_argument("--device", default="auto")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--language", default="en")
    parser.add_argument("--beam-size", type=int, default=3)
    return parser.parse_args()


def emit(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def main() -> int:
    args = parse_args()

    try:
        import numpy as np
        from faster_whisper import WhisperModel
    except Exception as exc:
        emit(
            {
                "id": 0,
                "error": (
                    "Python package 'faster-whisper' is not installed. "
                    "Install it with: python -m pip install faster-whisper"
                ),
                "detail": str(exc),
            }
        )
        return 1

    try:
        model = WhisperModel(
            args.model,
            device=args.device,
            compute_type=args.compute_type,
        )
    except Exception as exc:
        emit({"id": 0, "error": f"Failed to load faster-whisper model: {exc}"})
        return 1

    for line in sys.stdin:
        try:
            request = json.loads(line)
            request_id = int(request["id"])
            raw = base64.b64decode(request["samples_b64"])
            audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0

            segments_iter, _info = model.transcribe(
                audio,
                language=args.language,
                beam_size=args.beam_size,
                vad_filter=False,
                initial_prompt=PROMPT,
                condition_on_previous_text=False,
                temperature=0.0,
                without_timestamps=False,
            )

            segments = [
                {
                    "text": segment.text.strip(),
                    "start": float(segment.start),
                    "end": float(segment.end),
                }
                for segment in segments_iter
                if segment.text.strip()
            ]
            text = " ".join(segment["text"] for segment in segments)
            emit({"id": request_id, "text": text, "segments": segments})
        except Exception as exc:
            emit({"id": request.get("id", 0) if "request" in locals() else 0, "error": str(exc)})

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
