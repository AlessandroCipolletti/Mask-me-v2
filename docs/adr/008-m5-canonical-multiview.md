# ADR-008 — Canonical-reference multi-view generation

**Status:** Accepted for M5; real fal output and visual consistency pending user verification

## Context

M5 needs a six-view reconstruction input set without allowing generated side views to become new identity sources. Each additional fal request is paid, may outlive a page refresh, and can fail independently. Automated image similarity would not reliably prove that a stylized face, hairstyle or accessory is the same character.

## Decision

Treat the M4 image as the immutable `front` view. Submit five Nano Banana 2.1 edit jobs for front-left 45°, left profile, front-right 45°, right profile and rear. Every request contains only the same canonical HTTPS image URL in `image_urls`. The versioned view prompt changes camera angle while fixing identity, complete-head silhouette, materials, lighting and framing. The adapter owns the fal model ID, request schema, response parser and per-view provenance; the UI sees no fal schema.

`ViewSetSession` limits concurrent jobs to two, retains successful views, and lets one view be generated or regenerated independently. Once fal returns a request ID, the tab stores that ID with safe prompt and reference metadata in `sessionStorage`. Reload resumes acknowledged jobs with read-only status/result requests. Unacknowledged or unsent views require another explicit click. A user may explicitly forget an unrecoverable request before starting another paid job. The tab also retains the canonical image URL and completed view URLs for review; it stores neither credential nor source-photo bytes in the view set.

The automatic gate checks decoded dimensions, minimum resolution and expected aspect ratio and records reason codes. Missing dimensions require visual inspection. Each view needs explicit human acceptance before the set is considered ready. Visual identity, hairstyle, accessories, angle accuracy and rear silhouette are not assigned a fabricated automated score. M5 ends at a reviewed image set; reconstruction remains M6.

## Alternatives

- Recursive view generation from neighboring results risks accumulating identity and material drift.
- Launching all five jobs at once increases simultaneous paid work and complicates cancellation and recovery.
- A browser-side face embedding score would add a model and could give false confidence for profiles, glasses and rear views; no reliable M5 model was specified.
- Durable asset storage is deferred. Session URLs and request IDs are sufficient for this tab's M5 review, subject to provider URL lifetime.

## Evidence

The [Nano Banana 2.1 edit API](https://fal.ai/models/google/nano-banana-2.1/edit/api) accepts `image_urls`, `system_prompt`, 4:5 images and 2K output. Focused mock tests cover identical canonical references, prompt angles, two-job concurrency, independent retry, quality reasons, pause/recovery and storage validation. The development lab opens the six-view review screen without a key or paid call. Real fal image quality and Safari behavior require user testing.

## Tradeoffs and consequences

Five views may incur five model charges, plus any user-initiated retries. A job acknowledged before refresh can be recovered; a POST without a returned ID cannot be recovered reliably. fal image URLs may expire, so a stored tab snapshot is not a durable asset library. M6 can consume only a complete, manually accepted view set and must keep provider-specific reconstruction mapping in its own adapter.
