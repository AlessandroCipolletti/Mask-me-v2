# Avatar Studio

Browser-first personalized 3D avatar application. The project is being built one milestone at a time under the supplied specification pack. M0 is the engineering foundation; camera, generation, tracking, and rendering are intentionally unavailable in this build.

## Requirements

- Node.js 22 or newer
- pnpm 10

## Local commands

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
```

`pnpm build` writes a production static site to `dist/`. `pnpm build:debug` writes a debug build with source maps and a visible mode label to `dist-debug/`. The debug build is for local engineering use and should not be deployed as the public product.

Only non-secret values may use `VITE_` environment variables. The optional `VITE_PROVIDER=fal` setting identifies the intended initial provider; no provider request is made in M0. Never put a fal key or other credential in `.env` or a `VITE_` variable. User-owned credentials will be handled in volatile browser memory in M3.

See [STATUS.md](STATUS.md) for milestone status and [docs/adr/001-client-foundation.md](docs/adr/001-client-foundation.md) for the foundation decision.
