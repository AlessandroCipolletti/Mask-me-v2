# Avatar Studio

Browser-first personalized 3D avatar application. The project is being built one milestone at a time under the supplied specification pack. M1 adds local camera capture and a development Face Landmarker lab. Generation and 3D rendering are not implemented yet.

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

## M1 camera and tracking

Run `pnpm dev`, then open `/` for the camera capture screen or `/dev/tracking` for the development tracking lab. Camera access starts only when you press **Enable camera**. The lab shows raw face pose, blendshapes, landmark overlay, inference time, and tracking FPS. It reports confidence as unavailable because this Face Landmarker API does not expose a per-result confidence score. Photos are held in memory and no camera frames are uploaded.

For a built debug version, run `pnpm build:debug` followed by `pnpm preview:debug`. The production build excludes the tracking lab, MediaPipe runtime, model, and WASM assets. Camera preview and captured-photo display are mirrored visually; MediaPipe and the captured Blob use the original camera orientation.

ESLint uses the recommended JavaScript and TypeScript rules. Prettier owns formatting, and Husky checks the staged file contents before each local commit. Run `pnpm format`, then stage the formatted files again before committing. CI runs `pnpm format:check` across the project even when local Git hooks are skipped.

Only non-secret values may use `VITE_` environment variables. The optional `VITE_PROVIDER=fal` setting identifies the intended initial provider; no provider request is made in M0. Never put a fal key or other credential in `.env` or a `VITE_` variable. User-owned credentials will be handled in volatile browser memory in M3.

See [STATUS.md](STATUS.md) for milestone status, [ADR-001](docs/adr/001-client-foundation.md) for the foundation decision, and [ADR-002](docs/adr/002-m1-local-tracking.md) for the M1 tracking decision.
