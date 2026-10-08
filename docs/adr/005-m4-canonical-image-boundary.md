# ADR-005 — Canonical image generation boundary

**Status:** Accepted for M4; real model quality and Safari verification pending

## Context

M4 turns one user-approved camera still into the canonical stylized character image. The product has no backend. Its original page-lifetime key policy was later superseded by ADR-006 after an explicit user request for validated browser persistence. Prompt and model details will change independently of camera, UI and the provider queue.

## Decision

Keep the unmirrored, full-resolution camera `Blob` as the source of truth. The mirrored video is display-only; the review image shows the actual pixels sent to the model. Stop the camera after capture, retain the still through generation failures, and revoke its preview object URL on replacement or page exit.

Define the canonical prompt as versioned product logic. `CharacterImageGenerator` accepts a source still and returns one image plus safe provenance metadata. The Nano Banana 2 edit adapter owns its endpoint, parameters, input encoding and response validation. `FalClient` continues to own authentication, queue transport, polling and cancellation; it now returns the request ID alongside parsed data. A small composition root joins the adapter and transport, leaving the studio UI unaware of fal endpoints and response schemas.

The M4 request sends the selected JPEG as a data URI in the single explicit model job. The image is not uploaded during capture/review or during tests. No automatic POST retry occurs after an ambiguous failure. Metadata includes provider, model ID, prompt version, final prompt, parameters, source ID, timestamp and provider request ID; it excludes key and image bytes.

## Alternatives

- Uploading the source to fal storage before invoking the model would add a second remote transfer and a separate retention lifecycle. The documented data URI input supports this webcam-sized still directly; real browser/provider validation remains necessary.
- Putting the model ID and prompt in the UI would couple product behavior to the current model and make future changes hard to audit.
- Persisting results remains unnecessary for M4's in-page review. The original decision to keep keys volatile was later changed by ADR-006.

## Evidence

The [Nano Banana 2 edit API](https://fal.ai/models/fal-ai/nano-banana-2/edit/api) documents `image_urls`, data URI input, one-image output, 4:5 aspect ratio, PNG output, 2K resolution and the `images` response. Focused tests cover prompt constraints, job construction, metadata redaction, response validation and cancellation-sensitive session transitions. Real paid generation and image quality are deferred to user browser checks.

## Consequences

M5 can consume the canonical image and its metadata without coupling to the camera or Nano Banana response shape. The direct data URI grows the queue POST body and must be checked with real Safari/fal behavior. A cancelled remote job may still run or incur a charge, as in M3.
