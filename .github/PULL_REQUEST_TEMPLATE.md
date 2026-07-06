## Summary

<!-- What changed and why? One or two sentences a reviewer can understand without opening every file. -->

## Risk

<!-- What could break? Call out behavior-sensitive areas (STT, broadcast outputs, persisted stores, Tauri commands). -->

## Verification evidence

<!-- Paste or summarize command output. At minimum note whether you ran typecheck, lint, unit tests, and any manual checks. -->

```text
bun run typecheck
bun run lint
bun run test -- --run
cd src-tauri && cargo test --workspace
cd src-tauri && cargo clippy --workspace --all-targets --locked -- -D warnings
```

## Rollback notes

<!-- How to revert safely if this causes problems in production (revert commit, disable flag, etc.). -->

## Description

<!-- What does this PR do? Reference any related issues (e.g., `fixes #123`). -->

## Type of change

<!-- Check the one that applies: -->

- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring (no functional changes)
- [ ] Documentation
- [ ] Build / CI
- [ ] Performance improvement

## Areas affected

<!-- Check all that apply: -->

- [ ] Frontend (React / TypeScript)
- [ ] Backend (Rust / Tauri commands)
- [ ] Rust crate: <!-- specify which crate(s) -->
- [ ] Remote control (OSC / HTTP)
- [ ] Broadcast / NDI
- [ ] Theme Designer
- [ ] Bible data / search
- [ ] Audio / STT

## Checklist

- [ ] I have tested this change locally
- [ ] `bun run typecheck` passes
- [ ] `cargo clippy` passes without warnings
- [ ] `bun run test` passes (if applicable)
- [ ] I have added tests for new functionality (if applicable)
- [ ] UI changes include a screenshot or recording below

## Tested on

<!-- Check the platforms you tested on: -->

- [ ] macOS
- [ ] Windows
- [ ] Linux

## Screenshots / recordings

<!-- If this PR includes UI changes, add screenshots or recordings here. -->
