#!/usr/bin/env python3
"""Line-delimited JSON sherpa-onnx worker for SabbathCue local STT."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def emit(payload: dict) -> None:
    print(json.dumps(payload, separators=(",", ":")), flush=True)


def parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir")
    parser.add_argument("--encoder")
    parser.add_argument("--decoder")
    parser.add_argument("--joiner")
    parser.add_argument("--tokens")
    parser.add_argument("--sample-rate", type=int, default=16000)
    parser.add_argument("--num-threads", type=int, default=1)
    parser.add_argument("--decoding-method", default="modified_beam_search")
    parser.add_argument("--provider", default="cpu")
    parser.add_argument("--hotwords-file", default="")
    parser.add_argument("--hotwords-score", type=float, default=1.5)
    parser.add_argument("--max-active-paths", type=int, default=4)
    parser.add_argument("--chunk-samples", type=int, default=800)
    return parser


def one_file(model_dir: Path, pattern: str, label: str) -> str:
    matches = sorted(model_dir.glob(pattern), key=lambda path: (".int8." not in path.name, path.name))
    if not matches:
        raise FileNotFoundError(f"Sherpa model is missing {label} file matching {pattern}: {model_dir}")
    return str(matches[0])


def resolve_model_args(args: argparse.Namespace) -> tuple[str, str, str, str]:
    if args.model_dir:
        model_dir = Path(args.model_dir)
        return (
            args.encoder or one_file(model_dir, "encoder*.onnx", "encoder"),
            args.decoder or one_file(model_dir, "decoder*.onnx", "decoder"),
            args.joiner or one_file(model_dir, "joiner*.onnx", "joiner"),
            args.tokens or str(model_dir / "tokens.txt"),
        )

    missing = [
        name
        for name in ("encoder", "decoder", "joiner", "tokens")
        if not getattr(args, name)
    ]
    if missing:
        raise ValueError("Missing required Sherpa model arguments: " + ", ".join(missing))
    return args.encoder, args.decoder, args.joiner, args.tokens


def require_file(path: str, label: str) -> None:
    if not Path(path).is_file():
        raise FileNotFoundError(f"Sherpa {label} file not found: {path}")


def result_text(result: object) -> str:
    text = getattr(result, "text", result)
    return str(text).strip()


def main() -> int:
    args = parser().parse_args()
    try:
        import numpy as np
        import sherpa_onnx
    except Exception as exc:
        emit({"type": "error", "message": f"Python package 'sherpa-onnx' is not installed: {exc}"})
        return 1

    try:
        encoder, decoder, joiner, tokens = resolve_model_args(args)
        require_file(encoder, "encoder")
        require_file(decoder, "decoder")
        require_file(joiner, "joiner")
        require_file(tokens, "tokens")
        if args.hotwords_file:
            require_file(args.hotwords_file, "hotwords")

        recognizer = sherpa_onnx.OnlineRecognizer.from_transducer(
            tokens=tokens,
            encoder=encoder,
            decoder=decoder,
            joiner=joiner,
            num_threads=args.num_threads,
            sample_rate=args.sample_rate,
            feature_dim=80,
            enable_endpoint_detection=True,
            rule1_min_trailing_silence=2.4,
            rule2_min_trailing_silence=1.2,
            rule3_min_utterance_length=300,
            decoding_method=args.decoding_method,
            max_active_paths=args.max_active_paths,
            provider=args.provider,
            hotwords_file=args.hotwords_file,
            hotwords_score=args.hotwords_score,
        )
        stream = recognizer.create_stream()
        emit({"type": "ready"})

        last_partial = ""
        chunk_bytes = max(args.chunk_samples, 1) * 2
        while True:
            chunk = sys.stdin.buffer.read(chunk_bytes)
            if not chunk:
                break
            if len(chunk) % 2:
                chunk = chunk[:-1]
            if not chunk:
                continue

            samples = np.frombuffer(chunk, dtype="<i2").astype(np.float32) / 32768.0
            stream.accept_waveform(args.sample_rate, samples)
            while recognizer.is_ready(stream):
                recognizer.decode_stream(stream)

            text = result_text(recognizer.get_result(stream))
            if text and text != last_partial:
                last_partial = text
                emit({"type": "partial", "text": text, "words": []})

            if recognizer.is_endpoint(stream):
                if text:
                    emit({"type": "final", "text": text, "words": []})
                recognizer.reset(stream)
                last_partial = ""

        if hasattr(stream, "input_finished"):
            stream.input_finished()
        while recognizer.is_ready(stream):
            recognizer.decode_stream(stream)
        text = result_text(recognizer.get_result(stream))
        if text:
            emit({"type": "final", "text": text, "words": []})
        return 0
    except Exception as exc:
        emit({"type": "error", "message": str(exc)})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
