# ADR-002 — Local MediaPipe tracking spike

**Status:** Accepted for M1; revisit after profiling

## Context

M1 must establish local webcam tracking in Safari and Chromium while keeping MediaPipe output separate from future avatar controls. The web Face Landmarker API exposes landmarks, blendshapes, and facial transformation matrices. Its video inference call is synchronous, and the result does not include a per-result confidence score.

## Decision

Use `@mediapipe/tasks-vision` 0.10.35 in `VIDEO` mode with one face, blendshapes, transformation matrices, and the CPU delegate. Bundle the official float16 Face Landmarker task file in the debug tracking chunk. Vite emits the package's SIMD and non-SIMD WASM variants as local static assets, selected at runtime through `FilesetResolver.isSimdSupported()`. Keep inference on the main thread for this measured spike, scheduling only new video frames with `requestVideoFrameCallback` and a `requestAnimationFrame` fallback. Pause inference while the page is hidden, and close the detector when tracking stops.

The tracking boundary copies MediaPipe results into `TrackingObservation`, which contains raw diagnostic values but no provider objects. Raw pose is extracted in MediaPipe model coordinates; mirrored preview CSS does not affect inference or capture. Calibration, avatar coordinate conversion, confidence policy, and smoothing remain in M9.

## Alternatives

- A tracking worker: can reduce main-thread blocking, but adds video-transfer and Safari compatibility work before M1 performance is measured.
- GPU delegation: may improve throughput on some devices, but CPU provides a simpler Safari baseline for the initial spike.
- Remote CDN model/WASM loading: avoids local assets, but makes tracker initialization depend on additional runtime hosts.

## Evidence

Google's [web Face Landmarker guide](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js) documents synchronous `detectForVideo`, blendshape/matrix options, and the task model. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback) documents video frame callbacks and their browser support. The model is from `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, SHA-256 `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`. Deterministic tests cover scheduling, lifecycle, and pose extraction; real Safari performance remains a manual check.

## Tradeoffs

Synchronous CPU inference can lower UI responsiveness on slow devices. The debug lab exposes FPS and inference duration so this can be measured before choosing workers or GPU delegation. The debug build contains roughly 25 MB of model/WASM assets; the production M1 build excludes them because production tracking is not exposed until later milestones.

## Consequences

M9 can interpret `TrackingObservation` into semantic avatar controls without exposing MediaPipe-specific structures to the renderer. Replacing the detector or changing thread strategy stays inside the tracking layer.
