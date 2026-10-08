# ADR-004 — Volatile browser fal boundary

**Status:** Historical M3 decision; no-persistence policy superseded by ADR-006

## Context

The product has no application backend. A user supplies an API-scoped fal key in the browser, while later milestones will use different image and 3D models. M3 needs a provider transport and a real, safe connection check without beginning generation.

## Decision

Keep the key in a page-owned `VolatileCredential` instance only. Clear it on page exit, explicit clear, or disposal; never place it in application configuration, a URL, browser storage, logs, or a global debug object. A dedicated `/provider` page and the M3 portion of `/dev/generation` accept it through a password input, clear the input after transfer, and expose a user-initiated read-only pricing probe.

`FalClient` uses native `fetch` directly to fal HTTPS hosts with the key only in the `Authorization: Key` header, `credentials: omit`, `cache: no-store`, and no referrer. It owns queue submission, polling, result retrieval, best-effort cancellation, bounded retry of idempotent reads, error normalization, and transport response checks. `ProviderClient` accepts a model job whose future adapter supplies the endpoint, input and result parser. Submissions are never automatically retried because a lost response may still represent a billable job. No model adapter or generated-media pipeline is added in M3.

**Later correction:** A live M4 edit request showed that fal accepts submissions at the full endpoint path (for example `/edit`) but serves status, result and cancel under the app alias. `FalClient` now follows the [official JavaScript queue client's routing](https://github.com/fal-ai/fal-js/blob/main/libs/client/src/queue.ts), which removes the endpoint subpath for follow-up requests. HTTP 405 is surfaced as a protocol mismatch without retrying the read.

## Alternatives

- The fal JavaScript SDK: useful for its queue helpers, but its shared configuration and broad surface are unnecessary for this narrow page-owned credential lifecycle. The native protocol is small and can be replaced behind `ProviderClient` if needed.
- A backend proxy: would hide a server-owned key, but conflicts with the specified static browser-first deployment and user-owned credential model.
- A model generation call as the connection test: would incur a model charge and start M4 behavior. The authenticated pricing endpoint provides a read-only check.

## Evidence

fal documents [API-scoped keys and the `Key` header](https://fal.ai/docs/api-reference/platform-apis/authentication), the [authenticated pricing endpoint](https://fal.ai/docs/platform-apis/v1/models/pricing), and [direct queue submission](https://fal.ai/docs/documentation/quickstart). The [official JavaScript queue client](https://github.com/fal-ai/fal-js/blob/main/libs/client/src/queue.ts) documents status, result and cancel paths. Fixture tests cover request construction, phases, parse failures, error categories, POST retry policy and cancellation. A browser smoke check loaded both M3 routes without a key. A real key and Safari/Chrome provider check remain for the user.

## Tradeoffs

A browser-owned key is available to scripts running in that page, so deployment must avoid untrusted scripts. fal's general guidance favors server-held credentials; this product deliberately uses a user-provided page-lifetime key because it has no backend. Remote cancellation cannot guarantee that an already running job stops or avoids billing. Browser support and fal CORS behavior require a real manual check.

## Consequences

M4 and later model adapters can supply model-specific IDs, inputs, and parsers without changing credential handling or queue transport. The original M3 policy required key re-entry after leaving or reloading; ADR-006 supersedes that policy. Real provider calls remain explicitly user initiated.
