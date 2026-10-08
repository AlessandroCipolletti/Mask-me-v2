# Project status

## Current milestone: M4 — Canonical character generation

M0 through M3 are accepted. M4 implementation is complete; real Nano Banana image quality, camera and Safari behavior require the manual checks below. M5 has not started. The external specification pack at `/Users/cippo/Desktop/avatar3d-codex-spec-v3/` remains authoritative.

| M4 requirement                                             | Status                | Evidence / remaining check                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-resolution webcam still and unmirrored review         | VERIFIED              | Reuses `CameraService.capture()` JPEG pixels without preview resampling or mirroring. Studio stops the stream after capture, retains the Blob, and revokes preview URLs on replacement/page exit. Review media is constrained to the frame with `object-fit: contain`.                                                                    |
| Capture → review → generation → character review flow      | TESTED                | In-app Chromium loaded `/` and `/dev/generation` with the M4 controls. `CanonicalSession` tests cover review, generate, back, retake, cancellation, overlap prevention and failed regeneration. Real webcam interaction remains below.                                                                                                    |
| Versioned canonical identity and complete-head prompt      | VERIFIED              | `canonical-character-v3` keeps detailed identity and a subtle closed-mouth smile, and asks for gently flattering presentation through light, hair and materials without changing anatomy. Tests retain full-head framing, front pose, simple background and negative constraints.                                                         |
| Nano Banana 2 model adapter and output validation          | VERIFIED              | Adapter owns `fal-ai/nano-banana-2/edit`, source encoding, one-image parameters and HTTPS image parser. Mock tests cover request construction, metadata, malformed outputs and fal responses with nullable image dimensions.                                                                                                              |
| User-initiated provider lifecycle and error/retry handling | VERIFIED              | No request starts on boot, camera start, capture or review. Check connection sends a read-only pricing request; Create/Regenerate invokes one queue job. Queue polling/result/cancel now use the app alias, not an endpoint path such as `/edit`; focused tests protect the reported 405 case and the five-second queue polling interval. |
| Safe metadata and validated browser key                    | VERIFIED              | Metadata excludes key and image bytes. A key is stored in `localStorage` only after a successful, explicit connection check; restored keys display fixed password dots without exposing the real value; focused tests cover restore, failure, cancellation, malformed storage and clear. No key enters URLs, logs or diagnostics.         |
| `/dev/generation` inspection without production clutter    | TESTED                | Development route has upload, prompt/source/result/metadata inspection and read-only recovery of an existing fal request ID. Production has no lab route. Mock tests prove recovery uses GET requests only.                                                                                                                               |
| Refresh recovery of an acknowledged job                    | TESTED                | A confirmed queue ID and safe metadata are stored in tab `sessionStorage`; the source still is held in local IndexedDB. Reload resumes status/result GETs only, without another POST or a page-exit remote cancel. Mock tests cover the lifecycle; real Chrome/Safari refresh remains manual.                                             |
| Strong identity-preserving output across several people    | DEFERRED_VERIFICATION | Requires user-run paid Nano Banana generations and perceptual review. No paid automated request was made.                                                                                                                                                                                                                                 |
| Real camera, fal and Safari behavior                       | DEFERRED_VERIFICATION | User must check camera permission/capture orientation, direct fal request, image rendering and cleanup in Safari and Chrome.                                                                                                                                                                                                              |

M4 status counts: **VERIFIED 5 · TESTED 3 · DEFERRED_VERIFICATION 2 · BLOCKED 0 · OPEN_IMPLEMENTATION 0**.

### Manual M4 verification requested

Run `pnpm dev` and open `/` in Safari, then Chrome. Enter an API-scoped fal key and press **Check connection**; confirm “Connected to fal.” or inspect **Connection diagnostics** if it fails. Refresh and confirm the password field shows dots for a previously checked key without revealing the real key; **Clear key** should remove it even after another refresh. Before creating another paid job, use `/dev/generation` → **Recover an existing fal request** with the request ID from the reported 405 to try retrieving the first result. Then enable the camera, frame the whole head, take a photo, and confirm the review image is unmirrored and intact after the camera stops. Click **Create character** once to authorize a paid request. After the queue POST returns an ID, refresh the same tab while creation is running; confirm it still shows creation in progress, makes only status/result GET requests, and eventually shows the image. Confirm the entire generated image fits within the review frame without UI clipping. Inspect identity, full hair/head, ears where visible, small neck, a very subtle closed-mouth smile, detailed and gently flattering presentation without identity drift, and a simple background. Try **Back to photo**, **Regenerate character** (another paid request), and **Return to camera**. Repeat with several identities for the M4 visual exit criterion. Report browser/version, any error text and quality issues; do not send the key.

### M4 decisions and known issues

- [ADR-005](docs/adr/005-m4-canonical-image-boundary.md): source Blob ownership, versioned prompt, model adapter, direct data URI input and safe provenance metadata.
- [ADR-006](docs/adr/006-validated-browser-key-persistence.md): a user-requested successful connection check saves the key in browser `localStorage`; **Clear key** removes it.
- [ADR-007](docs/adr/007-m4-refresh-resume.md): a known generation job resumes after refresh using a tab-scoped request reference and a local source-photo draft.
- A user-side Nano Banana job submitted but polling returned HTTP 405 because the client incorrectly kept `/edit` in the status URL. The route is corrected per fal's official queue client and mock-verified. The earlier job may have completed or been billed; `/dev/generation` can now read it by request ID without another submit. Real recovery, new output and Safari behavior still need manual verification. The v3 prompt needs a manual comparison across identities to judge detail, smile subtlety, appeal, likeness and reconstruction suitability.
- A completed fal result returned HTTP 200 with `width` and `height` set to `null`; the image parser had rejected those optional values. The parser now omits null dimensions, and a fixture test matches the reported response. Resume the existing request to verify the image in the browser without another paid POST.
- fal image URLs are held only for the page session; no durable asset library is implemented in M4. A refresh before fal returns an ID cannot be recovered automatically, and browser storage failure may prevent restoring the source photo. Remote cancellation remains best effort and may still incur a charge.

### M4 validation

`pnpm check` passes typecheck, ESLint, Prettier, 57 focused tests, production build and debug build. `git diff --check` passes. The in-app Chromium browser loaded the production studio and development lab without requesting webcam permission or making a model call. Real key persistence, request recovery and corrected queue polling remain user browser checks. No real fal credential or paid request was used during automated validation.

## Previous milestone: M3 — fal browser integration

M0, M1 and M2 are accepted. M3 implementation was accepted before M4 began; the following retains its original evidence and historical manual checks. Its volatile-only key policy was superseded by ADR-006 after an explicit user request. The external specification pack at `/Users/cippo/Desktop/avatar3d-codex-spec-v3/` remains authoritative.

| M3 requirement                                             | Status                | Evidence / remaining check                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Volatile user-owned credential at M3                       | VERIFIED              | At M3, `VolatileCredential` was page-owned and no key was persisted. ADR-006 later changed this to save only after a successful connection check; URLs, configuration, logs and global debug state still exclude the key.                                                                              |
| Key entry UI and M3 `/dev/generation` slice                | TESTED                | `/provider` and `/dev/generation` booted in the in-app Chromium browser with key absent and connection action disabled. The debug page contains only M3 transport tooling.                                                                                                                             |
| Authenticated, read-only direct fal connection check       | DEFERRED_VERIFICATION | Pricing URL, `Key` header, no-store, omitted credentials, fetch receiver and response schema are fixture-tested. A reported instant pre-network failure was reproduced and fixed by calling native `fetch` with the browser global receiver. User must retest with their own key in Safari and Chrome. |
| Model-independent provider interface and queue transport   | VERIFIED              | `ProviderClient` accepts adapter-supplied model ID, input and parser; `FalClient` handles submit/status/result with request ID and status validation. Mock queue lifecycle test passes.                                                                                                                |
| Cancellation and safe retry policy                         | VERIFIED              | Abort stops local polling; queue cancellation uses best-effort PUT after known request ID; idempotent GETs have bounded retries. POSTs are never automatically retried. Focused tests cover cancellation and no POST retry.                                                                            |
| Error normalization, diagnostics and malformed responses   | VERIFIED              | Fixed safe messages cover provider and browser errors. Allowlisted diagnostics show click/fetch/response/failure stages, HTTP status, duration and a safe browser category without key or raw data. Mock tests cover failures and log redaction.                                                       |
| Explicit user action and no paid automated request         | VERIFIED              | The only M3 UI request is a click-triggered read-only pricing GET. Tests inject fake `fetch`; no test or build uses a real key or executes a model.                                                                                                                                                    |
| Direct browser compatibility and fal CORS in Safari/Chrome | DEFERRED_VERIFICATION | Native `fetch` avoids Chromium-only APIs; real browser response and CORS policy require user verification.                                                                                                                                                                                             |
| Production/debug separation and later model boundary       | VERIFIED              | Production exposes `/provider`; `/dev/generation` remains non-production. No model-specific generator, image upload, or reconstruction path is present. Production/debug build inspection required after final validation.                                                                             |

M3 status counts: **VERIFIED 6 · TESTED 1 · DEFERRED_VERIFICATION 2 · BLOCKED 0 · OPEN_IMPLEMENTATION 0**.

### Manual M3 verification requested

Historical M3 check: run `pnpm dev`; open `/provider` in Safari first, then Chrome. Paste an **API-scoped** fal key, press **Use key in this page**, then **Check connection**. Confirm success or send the **Connection diagnostics** lines, any browser Console CORS error, and browser/version (do not send the key). In Network, select **All** and enable **Preserve log**. ADR-006 changed refresh behavior: a successfully checked key is now restored, while **Clear key** removes it. No paid model action is needed.

### M3 decisions and known issues

- [ADR-004](docs/adr/004-m3-fal-browser-boundary.md): page-lifetime BYOK credential, native direct transport, authenticated read-only probe, queue lifecycle, no automatic POST retry.
- fal CORS and real key behavior in Safari/Chrome remain unverified until the user tests them. After the fetch receiver fix, the in-app browser records `fetch_start` and a 226 ms `failed_to_fetch` with no HTTP response; its network environment cannot establish whether fal CORS or connectivity caused that result.
- Queue cancellation is best effort. A running job can still complete or be billed by fal. No real model job was submitted in M3.

### M3 validation

`pnpm check` passes strict typecheck, ESLint, Prettier, 36 focused tests, production build, and debug build. `git diff --check` passes. The in-app Chromium browser loaded both M3 pages and exercised the diagnostics with a dummy key. Production output contains the provider page but no avatar, tracking, MediaPipe, model, or WASM assets; debug output retains the existing labs. No paid call or real fal credential was used.

## Previous milestone: M2 — Three.js runtime spike

M0 and M1 are accepted. M2 implementation was completed and accepted before M3. The following retains its original completion evidence and historical manual checks.

| M2 requirement                                                   | Status                | Evidence / remaining check                                                                                                                                                                |
| ---------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semantic `AvatarControlState` and canonical axes                 | VERIFIED              | Pure contract has no MediaPipe/Three.js dependency; copy and neutral-state tests pass; +X right, +Y up, +Z forward and radians are documented.                                            |
| Topology-independent avatar/rig adapter                          | VERIFIED              | `AvatarRigAdapter` accepts only semantic state; fixture mapping and disposal have focused tests.                                                                                          |
| Complete volumetric head follows one root                        | TESTED                | Unit test checks skull/hair/ears/jaw hierarchy; in-app Chromium visual check at yaw +45° showed side and rear-hair volume.                                                                |
| Independent blink, gaze, brows, jaw and mouth on fixture         | TESTED                | Focused adapter assertions and in-app Chromium checks for left blink and jaw 100%; all semantic controls are exposed in the lab.                                                          |
| Golden reference pose suite                                      | VERIFIED              | Deterministic tests cover neutral, angle extremes, independent blink, gaze, jaw, expressions, brows and combinations.                                                                     |
| Reusable synthetic animation source                              | VERIFIED              | Sequence and continuous sweep run without webcam; tests verify timing, manual override and deterministic sampling.                                                                        |
| `/dev/avatar` controls and diagnostics                           | TESTED                | In-app Chromium lab exercised pose selection and sweep, then reopened after navigation; it showed state, nodes, bounds, WebGL capability, FPS, frame time, draw calls, triangles and DPR. |
| Renderer, rig and GPU resource cleanup                           | VERIFIED              | Code inspection confirms geometry/material disposal, renderer disposal, context release, observer/listener removal and page-exit handling; fixture disposal test passes.                  |
| WebGL2 baseline, DPR cap, resize and visibility/context handling | VERIFIED              | Renderer explicitly requests WebGL2, caps DPR at 2, resizes camera/canvas and pauses/restarts on visibility and context events; WebGL2 lab booted in Chromium.                            |
| 60 FPS target on user's browsers/hardware                        | DEFERRED_VERIFICATION | In-app Chromium lab reported approximately 60 FPS; Safari and user's hardware need manual measurement.                                                                                    |
| Development-only 3D tooling and production exclusion             | VERIFIED              | Production build has no Three.js/avatar chunk; debug build contains `/dev/avatar` and the fixture.                                                                                        |
| Safari visual behavior and repeated GPU lifecycle                | DEFERRED_VERIFICATION | User must inspect pose quality, orbit, resizing, tab background/foreground and reload/revisit behavior in Safari.                                                                         |

M2 status counts: **VERIFIED 7 · TESTED 3 · DEFERRED_VERIFICATION 2 · BLOCKED 0 · OPEN_IMPLEMENTATION 0**.

### Manual M2 verification requested

Run `pnpm dev` and open `/dev/avatar` in Safari first, then Chrome. Select yaw ±45° and orbit behind the head to confirm true side/rear geometry; try blink left/right/both, gaze, brows, jaw 100%, smile, pucker and a combined pose. Run the reference sequence and continuous sweep. Check the reported FPS, resize the window, hide/restore the tab, and revisit the page. Report browser/version, FPS and any visual or cleanup defect. No webcam or fal key is needed.

### M2 decisions and known issues

- [ADR-003](docs/adr/003-m2-avatar-runtime.md): canonical semantic state, rig adapter, WebGL2 renderer ownership, deterministic procedural fixture and reusable synthetic source.
- The fixture is deliberately simple and has no morph targets. It proves the runtime contract, not arbitrary generated-avatar rigging; the latter remains M7/M8.
- The debug avatar chunk is about 550 kB minified and triggers Vite's size advisory. The production build excludes it.
- Real Safari behavior, user-machine FPS and repeated GPU cleanup remain unverified until manual testing.

### M2 validation

`pnpm check` passes strict typecheck, ESLint, Prettier, 27 focused tests, production build and debug build. The in-app Chromium browser rendered neutral, yaw +45°, left blink, jaw 100%, and continuous sweep at approximately 60 FPS in the lab; navigation away and back restarted WebGL successfully. `git diff --check` passes. No paid provider or webcam call was made.

## Previous milestone: M1 — Camera and tracking spike

M1 was completed and accepted before M2 work began. The following records its original completion evidence and remaining historical manual checks.

| M1 requirement                                                               | Status                | Evidence / remaining check                                                                                                          |
| ---------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| CameraService permission errors, start/cancel/stop, device lifecycle         | VERIFIED              | Unit tests cover permission normalization, duplicate start, late stream release, pending playback cancellation, and track stop.     |
| User-gesture camera permission, live preview, and device selection           | DEFERRED_VERIFICATION | Implemented; user must confirm real browser permission, preview, and camera switching.                                              |
| Still capture, repeat capture, and object URL cleanup                        | VERIFIED              | Tests confirm unmirrored capture, photo retention after stop, replacement by Take photo, and URL revocation on replacement/dispose. |
| Full-head guide and face-near-edge warning                                   | DEFERRED_VERIFICATION | Guide and deterministic edge check implemented; user must inspect framing with real hair/camera.                                    |
| Local Face Landmarker detection with model/WASM assets                       | DEFERRED_VERIFICATION | Debug build contains pinned local assets; real model initialization and facial movement need user browser testing.                  |
| Raw head pose matrix and yaw/pitch/roll diagnostics                          | VERIFIED              | Matrix decomposition and invalid/scale cases have focused tests. Pose remains uncalibrated until M9.                                |
| Landmark/blendshape boundary and honest confidence display                   | VERIFIED              | Fixture tests verify copied provider data and `null` confidence when the API supplies no per-result score.                          |
| Fresh-frame scheduling, no overlapping inference, fallback, visibility pause | VERIFIED              | Tracker tests cover deduplicated initialization, new-frame gating, animation-frame fallback, pause, and late detector disposal.     |
| Tracking FPS and inference-duration measurement                              | VERIFIED              | Measured around inference and emitted with each observation; focused test checks metrics.                                           |
| `/dev/tracking` screen and optional landmark overlay                         | TESTED                | Initial lab UI inspected in the in-app Chromium browser without enabling the camera.                                                |
| Camera/tracker cleanup on stop, track end, and page exit                     | VERIFIED              | Lifecycle tests and code inspection; actual Safari cleanup remains in manual checks.                                                |
| No upload and production/debug separation                                    | VERIFIED              | No request/upload code in M1 path; production build omits MediaPipe, model, WASM, and debug lab assets.                             |
| Real Safari/Chrome tracking stability and measured FPS                       | DEFERRED_VERIFICATION | User must test real webcam behavior, facial response, tab hide/resume, and FPS, starting with Safari.                               |

M1 status counts: **VERIFIED 8 · TESTED 1 · DEFERRED_VERIFICATION 4 · BLOCKED 0 · OPEN_IMPLEMENTATION 0**.

### Manual M1 verification requested

Run `pnpm dev` and open `/dev/tracking` in Safari first, then Chrome. Enable the camera and check permission, selection, mirrored preview, full hair framing, repeat capture with Take photo, live face/pose/blendshape response, tracking FPS and inference time. After taking a photo, verify that Stop camera releases the stream but leaves the photo visible. Press Enable camera and Take photo to replace it; the previous photo should remain until the new capture succeeds. Pause/resume tracking, hide/restore the tab, and confirm the camera releases. Report browser/version and any failures.

### M1 decisions and known issues

- [ADR-002](docs/adr/002-m1-local-tracking.md): local MediaPipe model/WASM, CPU VIDEO-mode inference, frame callback fallback, and raw observation boundary.
- MediaPipe does not expose a per-result confidence score through this task; the lab displays this as unavailable instead of fabricating one.
- Synchronous CPU inference may affect responsiveness on slow devices. The real FPS and Safari behavior remain unmeasured until manual testing.
- The debug build is larger because it contains the model and both SIMD/non-SIMD WASM variants; the production M1 build excludes them.

### M1 validation

`pnpm check` passes typecheck, ESLint, Prettier, 22 focused tests, production build, and debug build. Initial `/` and `/dev/tracking` screens and the built debug route were inspected in the in-app Chromium browser without camera permission. `pnpm preview:debug` starts successfully. Real webcam and Safari checks are deferred to the user.

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
