# ADR-001 — Lightweight client foundation

**Status:** Accepted

## Context

The product is browser-native, should deploy as static files without an application backend, and must remain usable in Safari and Chromium. M0 needs a runnable foundation without implementing later camera, tracking, provider, or 3D behavior.

## Decision

Use Vite, strict TypeScript, and browser DOM APIs for the M0 shell. Keep flow transitions in a pure module and keep public build configuration in a separate module. Use Vitest, ESLint, Prettier, and a single CI validation job. Production and debug builds have separate output directories; the debug build includes source maps and a visible mode label.

## Alternatives

- A UI framework: useful once interactive screens grow, but adds no value to the M0 boot screen. It can be introduced when the actual UI warrants it.
- SSR/full-stack framework: adds a server model that the product does not require.

## Evidence

The specification calls for a lightweight TypeScript client, no proprietary backend, and minimal framework complexity. M0 validates the toolchain through typecheck, lint, tests, and production/debug builds.

## Tradeoffs

The shell is intentionally small. Later interactive UI work may justify adopting a framework, which would require a follow-up decision.

## Consequences

Future provider, camera, tracking, and renderer modules can be added behind their prescribed boundaries without coupling them to a server or to M0's DOM shell.
