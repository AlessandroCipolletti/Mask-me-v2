# ADR-003 — Semantic avatar runtime and deterministic fixture

**Status:** Accepted for M2; generated-avatar implementation remains a later research gate

## Context

M2 needs a browser 3D runtime that future prepared avatars can use without coupling rendering to MediaPipe output or to any one mesh topology. It also needs a known-good fixture to validate head hierarchy and semantic facial controls before the generated-avatar problem is researched.

## Decision

Define `AvatarControlState` as the mutable, normalized semantic boundary. The canonical axes are +X avatar right, +Y up, +Z forward toward the viewer; angles are radians and translation is in avatar units. `AvatarRigAdapter` accepts that state and owns its internal geometry and semantic mapping. `AvatarRenderer` owns the WebGL2 Three.js scene, camera, lights, capped DPR, resize/visibility/context lifecycle, render clock, diagnostics, and disposal. It reads the latest state each render frame without a reactive UI update.

Build a procedural complete-head fixture as one adapter: skull, rear hair, ears, eyes, eyelids, brows, jaw, mouth interior, tongue and neck all sit under `HeadRoot`. Head pose moves the whole assembly; facial controls move their own groups. The deterministic `SyntheticControlSource` exposes the golden reference poses and a continuous sweep for this and future prepared rigs. `/dev/avatar` is dynamically imported only in non-production builds.

## Alternatives

- A third-party GLB rig fixture: potentially more polished, but adds asset licensing and opaque topology to the architecture spike.
- Driving meshes directly from MediaPipe data: would leak provider-specific signals into avatar animation and prevent fixture-only validation.
- WebGPU or a framework render loop: unnecessary for the WebGL2/Safari baseline and current DOM shell.

## Evidence

Unit tests cover state copying, the reference sequence, the full-head hierarchy, independent facial controls, input clamping, and resource disposal. The in-app Chromium browser rendered the fixture at yaw +45°, left blink, and full jaw opening; diagnostics reported approximately 60 FPS there. Three.js documents [`WebGLRenderer.setAnimationLoop`, sizing, statistics, and disposal](https://threejs.org/docs/pages/WebGLRenderer.html). Real Safari behavior and target-machine performance require user verification.

## Tradeoffs

The procedural fixture is visually simple and uses mesh transforms instead of true morph targets. It validates the semantic contract and lifecycle, but cannot prove that arbitrary generated geometry can be rigged; that remains M7/M8. The debug avatar chunk includes Three.js, while the production M2 bundle excludes it.

## Consequences

Future prepared avatars can implement `AvatarRigAdapter` and use the same renderer and synthetic controls. M9 can feed `AvatarControlState` after calibration and filtering without changing the renderer. The coordinate convention must remain centralized; browser mirroring and MediaPipe conversion belong in the later tracking interpreter.
