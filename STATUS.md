# Project status

## Current milestone: M1 — Camera and tracking spike

M0 is accepted. M1 implementation is complete pending the manual webcam and Safari/Chrome checks below. M2 has not started. The external specification pack at `/Users/cippo/Desktop/avatar3d-codex-spec-v3/` remains authoritative.

| M1 requirement                                                               | Status                | Evidence / remaining check                                                                                                      |
| ---------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| CameraService permission errors, start/cancel/stop, device lifecycle         | VERIFIED              | Unit tests cover permission normalization, duplicate start, late stream release, pending playback cancellation, and track stop. |
| User-gesture camera permission, live preview, and device selection           | DEFERRED_VERIFICATION | Implemented; user must confirm real browser permission, preview, and camera switching.                                          |
| Still capture, retake, and object URL cleanup                                | VERIFIED              | Unit test confirms unmirrored source capture; code inspection confirms URL revocation on retake/stop.                           |
| Full-head guide and face-near-edge warning                                   | DEFERRED_VERIFICATION | Guide and deterministic edge check implemented; user must inspect framing with real hair/camera.                                |
| Local Face Landmarker detection with model/WASM assets                       | DEFERRED_VERIFICATION | Debug build contains pinned local assets; real model initialization and facial movement need user browser testing.              |
| Raw head pose matrix and yaw/pitch/roll diagnostics                          | VERIFIED              | Matrix decomposition and invalid/scale cases have focused tests. Pose remains uncalibrated until M9.                            |
| Landmark/blendshape boundary and honest confidence display                   | VERIFIED              | Fixture tests verify copied provider data and `null` confidence when the API supplies no per-result score.                      |
| Fresh-frame scheduling, no overlapping inference, fallback, visibility pause | VERIFIED              | Tracker tests cover deduplicated initialization, new-frame gating, animation-frame fallback, pause, and late detector disposal. |
| Tracking FPS and inference-duration measurement                              | VERIFIED              | Measured around inference and emitted with each observation; focused test checks metrics.                                       |
| `/dev/tracking` screen and optional landmark overlay                         | TESTED                | Initial lab UI inspected in the in-app Chromium browser without enabling the camera.                                            |
| Camera/tracker cleanup on stop, track end, and page exit                     | VERIFIED              | Lifecycle tests and code inspection; actual Safari cleanup remains in manual checks.                                            |
| No upload and production/debug separation                                    | VERIFIED              | No request/upload code in M1 path; production build omits MediaPipe, model, WASM, and debug lab assets.                         |
| Real Safari/Chrome tracking stability and measured FPS                       | DEFERRED_VERIFICATION | User must test real webcam behavior, facial response, tab hide/resume, and FPS, starting with Safari.                           |

M1 status counts: **VERIFIED 8 · TESTED 1 · DEFERRED_VERIFICATION 4 · BLOCKED 0 · OPEN_IMPLEMENTATION 0**.

### Manual M1 verification requested

Run `pnpm dev` and open `/dev/tracking` in Safari first, then Chrome. Enable the camera and check permission, selection, mirrored preview, full hair framing, still capture/retake, live face/pose/blendshape response, tracking FPS and inference time. Pause/resume tracking, hide/restore the tab, stop/restart the camera, and confirm the camera releases. Report browser/version and any failures.

### M1 decisions and known issues

- [ADR-002](docs/adr/002-m1-local-tracking.md): local MediaPipe model/WASM, CPU VIDEO-mode inference, frame callback fallback, and raw observation boundary.
- MediaPipe does not expose a per-result confidence score through this task; the lab displays this as unavailable instead of fabricating one.
- Synchronous CPU inference may affect responsiveness on slow devices. The real FPS and Safari behavior remain unmeasured until manual testing.
- The debug build is larger because it contains the model and both SIMD/non-SIMD WASM variants; the production M1 build excludes them.

### M1 validation

`pnpm check` passes typecheck, ESLint, Prettier, 21 focused tests, production build, and debug build. Initial `/` and `/dev/tracking` screens and the built debug route were inspected in the in-app Chromium browser without camera permission. `pnpm preview:debug` starts successfully. Real webcam and Safari checks are deferred to the user.

## Previous milestone: M0 — Repository and engineering foundation

M0 was completed and accepted before M1 work began. The following records its original completion evidence.

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
