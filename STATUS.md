# Project status

## Current milestone: M6 — Complete-head 3D reconstruction

M0 through M5 are accepted. M6 implementation is complete and awaits real paid reconstruction, perceptual complete-head review and Safari verification by the user. M7 has not started. The external specification pack at `/Users/cippo/Desktop/avatar3d-codex-spec-v3/` remains authoritative.

| M6 requirement                                               | Status                | Evidence / remaining check                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Six approved views and model-specific mapping                | VERIFIED              | `FalReconstructionProvider` requires `viewSetReady` and maps front, both 45° views, both profiles and rear to the six documented Hunyuan 3D Pro v3.1 fields. Mock test inspects the exact paid-job input.                                                                                                                          |
| Explicit queue lifecycle, pause/cancel and GET-only recovery | VERIFIED              | `ReconstructionSession` records acknowledged IDs, prevents duplicate submit while pending, exposes queue stages, pauses on page exit, resumes with `ProviderClient.resume`, and retains failed results. Focused tests check recovery and no second POST.                                                                           |
| Result parsing and safe provenance                           | VERIFIED              | Adapter validates HTTPS GLB output and records provider/model, parameters, six input URLs and request IDs, timestamps, result URL and seed where supplied. No key or image bytes enter metadata.                                                                                                                                   |
| GLB sanitation and preview normalization                     | VERIFIED              | Local 560-byte GLB fixture parses through `GLTFLoader`; container checks reject malformed/oversized input. Scene inspection requires mesh triangles and finite, non-pathological bounds, reports mesh/material/texture counts and missing normals. Only the preview scene is centered/scaled; the original bytes remain unchanged. |
| Download retry and original preservation                     | DEFERRED_VERIFICATION | The result URL is retained, download retry does not resubmit the model, and IndexedDB stores the original Blob plus metadata. Browser quota/CORS and real large GLB persistence need user verification; direct GLB/metadata downloads are available.                                                                               |
| Orbitable Three.js review and local fixture lab              | TESTED                | The in-app Chromium browser loaded `src/reconstruction/fixtures/tetra.glb` in `/dev/generation` without a key or fal call. Orbitable WebGL2 canvas and inspection report appeared; no console errors were recorded. Production viewer is lazy loaded when the M6 stage is entered.                                                 |
| Complete-head identity and multiple distinct silhouettes     | DEFERRED_VERIFICATION | A real paid model run and human review must establish true face/skull/ears/hair/neck geometry across front, profiles and rear, plus visible differences between identities. The UI blocks very thin assets and requires explicit inspection/acceptance; deterministic bounds cannot prove likeness.                                |
| Safari provider, GLB/CORS, IndexedDB and WebGL behavior      | DEFERRED_VERIFICATION | Uses browser-standard fetch, IndexedDB and WebGL2 with resize/visibility/context handling. Real Safari and user's GPU/provider output remain manual checks.                                                                                                                                                                        |
| Error/retry behavior and development metadata                | VERIFIED              | Mock tests cover malformed output, rejected view sets, retained known job ID, download failure/retry without another POST, and tampered recovery data. `/dev/generation` exposes model/input/result metadata, geometry report and independent local GLB loading.                                                                   |

M6 status counts: **VERIFIED 5 · TESTED 1 · DEFERRED_VERIFICATION 3 · BLOCKED 0 · OPEN_IMPLEMENTATION 0**.

### Manual M6 verification requested

Use `pnpm dev` in Safari first, then Chrome. Start with a six-view set you have accepted. Open **Build 3D head**, then click the second **Build 3D head** button only when you intend one paid request. Confirm all six URLs appear in the submitted input and the queue status advances. Refresh after a request ID appears: the page should resume using status/result GETs, with no second POST. When the GLB arrives, orbit through front, both 45° angles, profiles and rear; check skull volume, nose/jaw/chin, ears, volumetric hair and neck, and compare two identities if you choose to pay for a second result. Test front alignment, raw GLB/metadata downloads, and refresh to confirm the original reopens from local storage. If the GLB download fails, use **Retry GLB download** and confirm no new model POST. Report browser/version, request ID, any error and screenshots of front/profile/rear; do not send the fal key.

### M6 decisions and known issues

- [ADR-009](docs/adr/009-m6-six-view-reconstruction.md): Hunyuan 3D Pro v3.1 six-angle adapter, exact raw GLB preservation, preview-only normalization, manual orientation and complete-head gate.
- Real model output may be incomplete or inconsistent despite a valid GLB. No test can certify complete-head identity; a thin-axis gate catches only obvious flat assets. This is a manual M6 exit check.
- The model's documented front input limit is 8 MB; a large upstream PNG may be rejected. Asset URLs may expire. IndexedDB can fail due to quota/privacy settings; download the original GLB and metadata when prompted. The browser rejects GLBs over 150 MB.
- The glTF scene is treated as Y-up. Semantic front is not inferred from arbitrary topology; the user aligns it in the review without modifying the original. The raw asset has no facial rig and is not driven by `AvatarControlState`.
- An unacknowledged POST cannot be recovered after refresh, even if the provider bills it. Remote cancellation is best effort. Real fal CORS, large-model performance and Safari persistence remain unverified.
- The lazy Three.js viewer chunk is about 632 kB minified and triggers Vite's size advisory. It is excluded from the initial studio chunk and loads only for model review or the local GLB lab.

### M6 validation

`pnpm check` passes typecheck, ESLint, Prettier, 81 focused tests, production build and debug build. `git diff --check` passes. The in-app Chromium browser loaded `/dev/generation`, opened the local GLB fixture with orbit controls, showed expected geometry diagnostics and reported no console errors. No real fal key, paid reconstruction or M7 rigging code was used.

## Previous milestone: M5 — Multi-view generation

M0 through M4 were accepted before M5. M5 implementation was accepted; the following retains its original evidence and historical manual checks. The external specification pack at `/Users/cippo/Desktop/avatar3d-codex-spec-v3/` remains authoritative.

| M5 requirement                                      | Status                | Evidence / remaining check                                                                                                                                                                                                                                     |
| --------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Six-view contract and reconstruction angles         | VERIFIED              | The M4 canonical image is `front`; five versioned prompts cover both 45° angles, both true profiles and the complete rear. Focused prompt tests check distinct directions and framing.                                                                         |
| Canonical-only provider reference and safe metadata | VERIFIED              | All five adapter jobs send the same canonical HTTPS image URL in `image_urls`; mock tests inspect every job. Per-view metadata records model, prompt version, final prompt, parameters, reference request ID, angle, timestamp and request ID without the key. |
| Bounded orchestration and independent retry         | VERIFIED              | `ViewSetSession` runs at most two jobs concurrently, retains successful results, retries one angle, and prevents a duplicate paid submit for a known pending ID. Deterministic tests cover these transitions.                                                  |
| Pause and refresh recovery                          | VERIFIED              | Tab-scoped view-set storage retains URLs, results and acknowledged request IDs. Reload resumes GET-only jobs; unsent work needs an explicit Generate click. Tests cover storage validation, pause and read-only recovery. Real reload remains a browser check. |
| Structural quality reasons and human review gate    | VERIFIED              | Image dimensions are read from fal metadata or the decoded browser image. The gate flags low resolution, wrong aspect ratio and unavailable images. Every angle requires explicit acceptance; visual identity, hair and accessories remain human judgments.    |
| Production contact sheet and development inspection | TESTED                | The M5 review screen and fixture URL entry loaded in the in-app Chromium browser without a key or paid request. The contact sheet shows all six positions; `/dev/generation` exposes each view's prompt metadata and quality reasons.                          |
| Real multi-view identity and geometry usefulness    | DEFERRED_VERIFICATION | User must generate and inspect real paid outputs, especially profile nose/ear/jaw depth and the rear skull/hair silhouette. No paid call was made by Codex.                                                                                                    |
| Safari provider/image and refresh behavior          | DEFERRED_VERIFICATION | Real Safari image loading, queue recovery, visual review and repeated retry need user browser verification.                                                                                                                                                    |

M5 status counts: **VERIFIED 5 · TESTED 1 · DEFERRED_VERIFICATION 2 · BLOCKED 0 · OPEN_IMPLEMENTATION 0**.

### Manual M5 verification requested

Run `pnpm dev` in Safari first, then Chrome. Start from a canonical image, click **Continue to views**, then **Generate five views** once (five paid fal jobs). Check that the two 45° views, both true profiles and rear view show the same character, hair volume, colors, accessories, neck and material style; check useful nose, ears, jaw, rear skull and hair silhouette. The browser Network tab should show each edit POST referencing the same canonical URL and no more than two active jobs. Accept good views, flag and regenerate one poor view, and confirm the others stay intact. Refresh while a view has an acknowledged request ID; confirm it resumes with status/result GETs and no new POST. Inspect per-view metadata and reasons in `/dev/generation`. If you already have a public canonical fal image URL, the development lab can use it directly without paying for another M4 image. Do not send the fal key.

### M5 decisions and known issues

- [ADR-008](docs/adr/008-m5-canonical-multiview.md): canonical-only references, two-job limit, per-view recovery, structural quality gate and manual acceptance.
- Fal image URLs are retained only for the browser tab and may expire. An unacknowledged POST cannot be recovered after refresh; it may still have been charged. A known job that cannot be retrieved must be explicitly forgotten before a replacement submit.
- Automated checks cannot establish that a side or rear image is the same character or even the correct viewing angle. The M5 visual exit criterion is `DEFERRED_VERIFICATION` until real outputs are reviewed.

### M5 validation

`pnpm check` passes typecheck, ESLint, Prettier, 71 focused tests, production build and debug build. `git diff --check` passes. The in-app Chromium browser opened `/dev/generation`, entered a public canonical fixture URL, inspected the six-view review surface, navigated back to the character and forward again, and reloaded the tab to restore the review state without a key or paid request. No M6 reconstruction code or real fal credential was used.

## Previous milestone: M4 — Canonical character generation

M0 through M3 were accepted before M4. M4 implementation was accepted; its real Nano Banana 2.1 image quality, camera and Safari checks remain historical manual checks below. M5 had not started at M4 completion. The external specification pack at `/Users/cippo/Desktop/avatar3d-codex-spec-v3/` remains authoritative.

| M4 requirement                                             | Status                | Evidence / remaining check                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full-resolution webcam still and unmirrored review         | VERIFIED              | Reuses `CameraService.capture()` JPEG pixels without preview resampling or mirroring. Studio stops the stream after capture, retains the Blob, and revokes preview URLs on replacement/page exit. Review media is constrained to the frame with `object-fit: contain`.                                                                    |
| Capture → review → generation → character review flow      | TESTED                | In-app Chromium loaded `/` and `/dev/generation` with the M4 controls. `CanonicalSession` tests cover review, generate, back, retake, cancellation, overlap prevention and failed regeneration. Real webcam interaction remains below.                                                                                                    |
| Versioned canonical identity and complete-head prompt      | VERIFIED              | `canonical-character-v8` adds a fixed dimensional CG style instruction and stricter adult-age preservation to the eye, skin and hair detail rules. It retains identity, a subtle smile, and the requested conditional under-20 age rule. Tests retain full-head framing, front pose, simple background and negative constraints.          |
| Nano Banana 2.1 model adapter and output validation        | VERIFIED              | New jobs use `google/nano-banana-2.1/edit`; recovery also accepts earlier `fal-ai/nano-banana-2/edit` jobs. Adapter owns source encoding, one-image parameters and HTTPS image parser. Mock tests cover request construction, metadata, malformed outputs and fal responses with nullable image dimensions.                               |
| User-initiated provider lifecycle and error/retry handling | VERIFIED              | No request starts on boot, camera start, capture or review. Check connection sends a read-only pricing request; Create/Regenerate invokes one queue job. Queue polling/result/cancel now use the app alias, not an endpoint path such as `/edit`; focused tests protect the reported 405 case and the five-second queue polling interval. |
| Safe metadata and validated browser key                    | VERIFIED              | Metadata excludes key and image bytes. A key is stored in `localStorage` only after a successful, explicit connection check; restored keys display fixed password dots without exposing the real value; focused tests cover restore, failure, cancellation, malformed storage and clear. No key enters URLs, logs or diagnostics.         |
| `/dev/generation` inspection without production clutter    | TESTED                | Development route has upload, prompt/source/result/metadata inspection and read-only recovery of an existing fal request ID. Production has no lab route. Mock tests prove recovery uses GET requests only.                                                                                                                               |
| Refresh recovery of an acknowledged job                    | TESTED                | A confirmed queue ID and safe metadata are stored in tab `sessionStorage`; the source still is held in local IndexedDB. Reload resumes status/result GETs only, without another POST or a page-exit remote cancel. Mock tests cover the lifecycle; real Chrome/Safari refresh remains manual.                                             |
| Strong identity-preserving output across several people    | DEFERRED_VERIFICATION | Requires user-run paid Nano Banana 2.1 generations and perceptual review. No paid automated request was made.                                                                                                                                                                                                                             |
| Real camera, fal and Safari behavior                       | DEFERRED_VERIFICATION | User must check camera permission/capture orientation, direct fal request, image rendering and cleanup in Safari and Chrome.                                                                                                                                                                                                              |

M4 status counts: **VERIFIED 5 · TESTED 3 · DEFERRED_VERIFICATION 2 · BLOCKED 0 · OPEN_IMPLEMENTATION 0**.

### Manual M4 verification requested

Run `pnpm dev` and open `/` in Safari, then Chrome. Enter an API-scoped fal key and press **Check connection**; confirm “Connected to fal.” or inspect **Connection diagnostics** if it fails. Refresh and confirm the password field shows dots for a previously checked key without revealing the real key; **Clear key** should remove it even after another refresh. Before creating another paid job, use `/dev/generation` → **Recover an existing fal request** with the request ID from the reported 405; select **Nano Banana 2 (earlier jobs)** to try retrieving the first result. Then enable the camera, frame the whole head, take a photo, and confirm the review image is unmirrored and intact after the camera stops. Click **Create character** once to authorize a paid request. After the queue POST returns an ID, refresh the same tab while creation is running; confirm it still shows creation in progress, makes only status/result GET requests, and eventually shows the image. Confirm the entire generated image fits within the review frame without UI clipping. Inspect identity, full hair/head, ears where visible, small neck, accurate eye shape/size/spacing/position and eyelids, a very subtle closed-mouth smile, skin with subtle tonal and surface detail, hair with layered volume and readable strands, the conditional age treatment without identity drift, and a simple background. For this variation check, generate the same source photo more than once only if you choose to incur additional fal charges; compare material style and apparent age. Check modest rejuvenation only for a person clearly under 20 and no age change otherwise. Try **Back to photo**, **Regenerate character** (another paid request), and **Return to camera**. Repeat with several identities for the M4 visual exit criterion. Report browser/version, any error text and quality issues; do not send the key.

### M4 decisions and known issues

- [ADR-005](docs/adr/005-m4-canonical-image-boundary.md): source Blob ownership, versioned prompt, model adapter, direct data URI input and safe provenance metadata.
- [ADR-006](docs/adr/006-validated-browser-key-persistence.md): a user-requested successful connection check saves the key in browser `localStorage`; **Clear key** removes it.
- [ADR-007](docs/adr/007-m4-refresh-resume.md): a known generation job resumes after refresh using a tab-scoped request reference and a local source-photo draft.
- A user-side Nano Banana job submitted but polling returned HTTP 405 because the client incorrectly kept `/edit` in the status URL. The route is corrected per fal's official queue client and mock-verified. The earlier job may have completed or been billed; `/dev/generation` can now read it by request ID without another submit. Real recovery, new output and Safari behavior still need manual verification. The new Nano Banana 2.1 endpoint and the v8 prompt need manual comparison across identities and repeated runs of the same source to judge eye fidelity, skin and hair material richness, smile subtlety, appeal, conditional apparent-age treatment, likeness and reconstruction suitability. The age condition is guidance to the image model, not a deterministic age classifier; prompt and system instruction cannot guarantee identical style or age in every stochastic result.
- A completed fal result returned HTTP 200 with `width` and `height` set to `null`; the image parser had rejected those optional values. The parser now omits null dimensions, and a fixture test matches the reported response. Resume the existing request to verify the image in the browser without another paid POST.
- fal image URLs are held only for the page session; no durable asset library is implemented in M4. A refresh before fal returns an ID cannot be recovered automatically, and browser storage failure may prevent restoring the source photo. Remote cancellation remains best effort and may still incur a charge.

### M4 validation

`pnpm check` passes typecheck, ESLint, Prettier, 59 focused tests, production build and debug build. `git diff --check` passes. The in-app Chromium browser loaded the production studio and development lab without requesting webcam permission or making a model call. Real key persistence, request recovery and corrected queue polling remain user browser checks. No real fal credential or paid request was used during automated validation.

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
