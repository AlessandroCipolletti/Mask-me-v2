# ADR-009 — Six-view complete-head reconstruction and original asset ownership

**Status:** Accepted for M6; real model output and Safari verification pending

## Context

M6 must reconstruct a true complete head from the six approved M5 views. The model has arbitrary topology and is not yet an animatable avatar. Existing Hunyuan v2 multi-view accepts only cardinal images and its documented example returns a white mesh; the M5 45° images should not be silently discarded. A remote result URL alone may expire before M7 research.

## Decision

Use fal's `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` endpoint behind `ReconstructionProvider`. Its documented fields accept front, both front 45° views, left, right and back. Submit the exact approved URLs with `generate_type: Normal` and the documented 500,000 face target. The adapter owns the field mapping, output parser, model ID and provenance; `FalClient` continues to own authenticated queue transport. No automatic paid request occurs. An acknowledged request ID is stored in tab-scoped session storage and resumes with GET-only status/result calls. An explicit cancel is best effort; pausing or leaving the page does not cancel the remote job.

Download the returned GLB bytes without altering them, validate the GLB 2.0 container and parsed scene, and store the original Blob with model metadata in browser IndexedDB. The user can download both the raw GLB and metadata. A failed download can be retried from the retained result URL without submitting another model job. A local storage failure leaves the in-tab Blob available and warns the user to download it. Rebuilding requires another explicit click.

The Three.js viewer parses the GLB, measures finite bounds, mesh/material/texture counts and missing normals, then centers and uniformly scales a **preview copy** to 2.4 avatar units. glTF is Y-up; front alignment remains user-adjustable around Y because arbitrary generated geometry has no reliable semantic forward marker. The original GLB is never rewritten. Orbit controls allow all directions. A very thin model is blocked from acceptance; the user must inspect the full head and explicitly accept. This review does not imply facial rigging or animation readiness.

## Alternatives

- Hunyuan v2 multi-view omits 45° fields and its documented example yields an untextured mesh.
- A four-image model would discard two accepted reconstruction inputs.
- Automatically guessing semantic front from arbitrary mesh vertices would fabricate orientation certainty.
- Keeping only the provider URL risks losing the costly original if that URL expires.

## Evidence

The [fal Hunyuan 3D Pro v3.1 schema](https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/pro/image-to-3d/api) documents six exact input fields, `model_glb`, `Normal` output and face-count range. The [older Hunyuan v2 multi-view schema](https://fal.ai/models/fal-ai/hunyuan3d/v2/multi-view/api) documents cardinal input fields and `model_mesh`. Mock tests verify six-view mapping, safe result parsing, acknowledged-ID recovery, no duplicate paid submit and download retry. A local GLB fixture validates container and scene checks; the development browser rendered it with orbit controls. Real paid output quality, direct asset CORS and Safari remain user checks.

## Tradeoffs and consequences

A 500,000-face result can be large and slow to load; the 150 MB browser cap rejects extreme assets and the debug report exposes geometry size. fal's front image limit is 8 MB, so unexpectedly large upstream PNGs may be rejected by the model and require a future targeted preprocessing decision. Browser IndexedDB may be denied or quota-limited; the downloadable original is the fallback. Geometry completeness and identity remain perceptual criteria, so an automated bounds check cannot certify them. M7 can experiment on the preserved raw asset without a new reconstruction charge. No M7 rigging approach is chosen here.
