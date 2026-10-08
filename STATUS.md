# Project status

## Current milestone: M0 — Repository and engineering foundation

Implementation is limited to M0. M1 has not started. The external specification pack at `/Users/cippo/Desktop/avatar3d-codex-spec-v3/` is authoritative; this status file tracks implementation and verification.

| M0 requirement                               | Status                | Evidence / remaining check                                                             |
| -------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| TypeScript client app and static boot screen | VERIFIED              | Strict typecheck and production build; visible boot in the in-app Chromium browser.    |
| Lint, format, and typecheck tooling          | VERIFIED              | `pnpm lint`, `pnpm format:check`, `pnpm typecheck`                                     |
| Unit test runner                             | VERIFIED              | Focused flow, config, and safe-logging tests via `pnpm test`                           |
| Basic CI                                     | VERIFIED              | GitHub Actions runs frozen install and `pnpm check`; hosted run awaits first push.     |
| Public environment/provider configuration    | VERIFIED              | Explicit mode/provider parser; no credential environment variable or provider call.    |
| Strict no-secret logging utility             | VERIFIED              | Fixed event names and numeric metrics only; production logger disabled.                |
| Simple application state machine             | VERIFIED              | Pure ordered phase transitions, entry timestamps, reset, and invalid-transition tests. |
| Production/debug build distinction           | VERIFIED              | Separate outputs; debug source maps and mode label, production without them.           |
| Safari and installed Chrome boot             | DEFERRED_VERIFICATION | User should open the M0 build in both browsers. Computer-use denied Safari access.     |

The M0 foundation deliberately does not implement camera, tracking, fal requests, generation, 3D rendering, or later UI. Those are assigned to M1 and later milestones.

## Decisions

- [ADR-001](docs/adr/001-client-foundation.md): lightweight static client foundation.

## Validation

`pnpm check` passed: TypeScript typecheck, ESLint, Prettier check, 8 unit tests, production build, and debug build. The Vite development server showed the boot screen in the in-app Chromium browser. The production output contains no source map; the debug output contains a source map and debug label. CI configuration was inspected locally but has not run on GitHub yet.

M0 requirement status counts: **VERIFIED 8 · TESTED 0 · DEFERRED_VERIFICATION 1 · BLOCKED 0 · OPEN_IMPLEMENTATION 0**.

## Tooling follow-up

Husky now runs a Prettier check against staged file contents before local commits. ESLint includes its recommended JavaScript/TypeScript rules with `eslint-config-prettier` last. CI continues to check formatting across the full project. The hook was tested with staged unformatted content and a formatted working copy; it blocked the commit candidate until the formatted file was staged. The M0 requirement counts and milestone scope are unchanged.
