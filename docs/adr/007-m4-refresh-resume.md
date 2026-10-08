# ADR-007 — Resume a submitted generation after refresh

**Status:** Accepted for M4; real browser verification pending

## Context

A user may refresh while fal is still processing a paid canonical-image request. The original page-owned session lost the request ID and treated page exit like an explicit cancellation. The user asked to return to an in-progress character without submitting another paid job.

## Decision

After fal acknowledges the queue POST, synchronously save the request ID and nonsecret generation metadata in this tab's `sessionStorage`. Before the POST, save the selected source-photo `Blob` in IndexedDB so the same tab can show the photo and retain the review controls after refresh. Do not put the key, source bytes, or image data in `sessionStorage` or URLs. A previously checked key is restored according to ADR-006; if no key is available, wait for the user to provide one.

On page exit, stop local waiting and release camera and object URLs without sending fal a remote cancel. On reload or BFCache return, retrieve the saved photo if available and resume the known job with authenticated status/result GET requests only. The provider never automatically repeats the queue POST. **Stop checking** pauses a recovered job locally and keeps its reference; **Cancel generation** on a newly submitted job retains its existing best-effort remote cancellation behavior. Clear the pending reference after completion, explicit cancellation, or **Forget saved request**. Clear the local source photo when the user retakes, clears the key, or exits with no pending job; a later visit with no pending reference also removes stale photo data.

## Limits

If refresh happens before fal returns a request ID, or browser storage is unavailable, automatic recovery cannot be guaranteed. A submitted job may still run or incur a charge. The source photo remains in this browser's IndexedDB while a pending job needs recovery; it is never uploaded as webcam video. fal image URLs are still page-lifetime data, not a durable asset library.

## Evidence

Focused tests cover request-ID publication, state recovery, session-storage validation, and the distinction between page exit and explicit cancellation. Real refresh, IndexedDB, fal queue and Safari behavior require manual browser verification.
