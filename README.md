# Avatar Studio

Browser-first personalized 3D avatar application. The project is being built one milestone at a time under the supplied specification pack. M1 adds local camera capture and a development Face Landmarker lab. M2 adds a separate Three.js avatar runtime and synthetic animation lab. M3 adds a browser-side fal connection boundary. AI generation is not implemented yet.

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

## M2 avatar runtime

Run `pnpm dev` and open `/dev/avatar` to inspect the deterministic 3D fixture without a webcam. Select any reference pose, play the complete pose sequence, run the continuous sweep, or adjust semantic sliders. Drag the viewport to orbit around the real 3D head and scroll to zoom. The page reports render FPS, CPU frame times, draw calls, triangles, bounds, applied controls, and fixture nodes. The fixture proves the animation boundary; it is not a personalized generated avatar. The production build excludes Three.js and the avatar lab.

## M3 fal connection

Open `/provider` for the key entry page, or `/dev/generation` in a development/debug build for the M3 development surface. Paste an API-scoped fal key without the `Key ` prefix and press **Use key in this page**, then **Check connection**. The check sends one read-only pricing request directly to fal; it does not execute a model or incur model charges. The key stays in page memory, clears from the input after entry, and is removed when the page is left or reloaded. **Clear key** removes it immediately. No key is needed for automated tests or builds. Camera frames remain local; future generation will send only selected still images.

If the connection fails, expand **Connection diagnostics**. It records the click, fetch start, HTTP status if received, elapsed time, and a safe browser failure category. The same events appear in DevTools Console. Select **All** in DevTools Network and enable **Preserve log**. Diagnostics intentionally omit the key, headers, payload and raw response. A browser `fetch` failure cannot itself distinguish CORS from DNS or a blocked connection; the browser Console may supply that detail.

ESLint uses the recommended JavaScript and TypeScript rules. Prettier owns formatting, and Husky checks the staged file contents before each local commit. Run `pnpm format`, then stage the formatted files again before committing. CI runs `pnpm format:check` across the project even when local Git hooks are skipped.

Only non-secret values may use `VITE_` environment variables. The optional `VITE_PROVIDER=fal` setting identifies the provider. Never put a fal key or other credential in `.env` or a `VITE_` variable. User-owned credentials are handled in volatile browser memory.

See [STATUS.md](STATUS.md) for milestone status and [docs/adr](docs/adr/) for architectural decisions.
