# ADR-006 — Persist a validated fal key in the browser

**Status:** Accepted; supersedes ADR-004's no-persistence decision

## Context

M3 originally kept the user-owned fal key in page memory only. The user requested that a refresh recognize an existing key, provided the key passed an explicit connection check first. The product remains browser-first and has no backend.

## Decision

Keep newly entered keys in memory until the user clicks **Check connection** and the authenticated, read-only fal pricing probe succeeds. Only then write the raw key to this origin's `localStorage`. On page load or BFCache restore, load a previously verified key into the in-memory credential and show a fixed masked value in the password field. The actual key is never placed in that field; the masked value cannot be submitted as a replacement key. Never run a probe or paid model call automatically during restoration.

Entering a replacement key removes the previous stored key after local input validation. **Clear key** removes the stored and in-memory key. A 401 authentication failure removes both; other network, rate-limit and quota failures do not prove an already saved key invalid. Page exit clears the in-memory reference but retains the verified local copy. If browser storage is unavailable, the connection can still succeed and the UI reports that the key was not saved.

Keep keys out of URLs, build configuration, diagnostics, logs, and error messages. No CI or automated test uses a real key. The storage access and verify-then-save transition are covered by deterministic tests.

## Tradeoffs

`localStorage` is durable and readable by JavaScript on this origin. It is not an encrypted secret vault; scripts with access to the page, browser extensions, or another person using the same browser profile may obtain the key. The UI discloses browser storage, and users can remove the key with **Clear key**. This persistence is an explicit product choice that replaces M3's volatile-only default.

## Consequences

Returning users can refresh or revisit without re-entering a successfully checked key. A restored key was valid at the last check, but may later be revoked; it is not silently revalidated. The user can run **Check connection** again. Generation remains user initiated.
