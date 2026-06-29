# Why These Changes Matter — And What They Mean for Users

**The desktop app cannot ship today because of a single unused line of code, and once that is removed the app is releasable.** Everything else in the plan makes the code easier to maintain — it does not fix a broken feature, because no feature is broken. For the person running a live church service, the immediate change means the app builds and installs again; the longer work means future bugs get found and fixed faster, with less risk of breaking something else.

## The one thing blocking release

One import line in `src/components/queue/QueueWorkspace.tsx` brings in a function (`useBroadcastStore`) that the file never uses. The build is configured to treat an unused import as an error, so `bun run build` stops there. Removing the word `useBroadcastStore` from that line fixes it. The fix is one character-level edit and changes nothing the user sees.

This matters because it is the *only* gate currently red. The automated test net is strong — 757 frontend tests and 631 Rust tests pass, code duplication is 0.72% (well under the 3% limit), and the Rust linter is clean. There is no hidden crisis. The app is one line away from building.

## Why the app still isn't "production-ready" after that

Building is not the same as proven. Three things have **not been tested yet** and should be before a real Sabbath service depends on the app:

- **Live hardware path** — microphone → speech-to-text → verse detection → on-screen slide, end to end, with a real person speaking.
- **NDI output** — sending the broadcast to a physical monitor or video switcher on the network.
- **Endurance** — a 90-minute run to confirm no memory leak or frame-rate collapse mid-service.

These are gaps in *verification*, not known defects. The logic underneath them is tested in isolation; what is missing is one real-world run on real hardware. For the user, this is the difference between "the parts work" and "we watched the whole thing work live."

## Why the refactoring needs to happen

**Six files have grown too large to debug precisely, and that directly affects how fast problems get fixed.** The largest, the Rust verse-detection engine, is 2,365 lines. Five others sit between 1,130 and 1,256 lines. When something breaks inside a 2,365-line file, finding the cause is slow and the fix risks disturbing unrelated logic in the same file.

The plan splits each large file into focused pieces of roughly 400 lines, organized by what they do. This serves two concrete goals:

1. **Bugs become easier to locate.** A failure points to one small module — "the text-layout code" — instead of one enormous file. The person fixing it reads less and guesses less.
2. **Changes become safer and easier to track.** Each edit lands in a small, reviewable piece. A reviewer can see exactly what changed and why, and a mistake is contained to one module instead of rippling through a thousand lines.

Critically, **this refactoring changes nothing the user experiences.** It moves code without altering behavior — every test must stay green throughout, and every public function keeps its exact signature. The user gets the same app, built on code that the team can fix faster and break less often.

## What is deliberately being left alone

The three highest-risk Rust files — the core detection engine, the reference parser, and the reading-mode state machine — are **frozen**. No new features go into them until their splits are planned separately. This is a safety decision: these files run the live detection path, and changing them carelessly is the most likely way to break the one thing the app exists to do — turn spoken scripture into the right slide on screen.

## The order, and why

The work is sequenced from safest to riskiest:

1. **Fix the build** (one line) — unblocks everything, today.
2. **Commit the in-progress work** onto a branch so the main code is never left broken.
3. **Verify the live paths** on real hardware before calling it production-ready.
4. **Refactor**, starting with the low-risk database-helper cleanup and ending with the high-risk live detection code.

For the user, the payoff arrives in stages: a working build now, a verified-on-hardware app next, and over time an app whose bugs are caught and fixed before they reach a live service.

---

*Companion document: [PRODUCTION_REMEDIATION_PLAN.md](PRODUCTION_REMEDIATION_PLAN.md) — the executable, checkpoint-based plan. Source findings: [PRODUCTION_SWEEP_REPORT.md](PRODUCTION_SWEEP_REPORT.md) and [PRODUCTION_ACTION_PLAN.md](PRODUCTION_ACTION_PLAN.md), independently re-verified 2026-06-29.*
