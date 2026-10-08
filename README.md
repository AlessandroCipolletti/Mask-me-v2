# Avatar Studio

Browser-first personalized 3D avatar application. The project is being built one milestone at a time under the supplied specification pack. M1 adds local camera capture and a development Face Landmarker lab. M2 adds a separate Three.js avatar runtime and synthetic animation lab. M3 adds a browser-side fal connection boundary. M4 generates one canonical stylized character image from a user-approved still photo.

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

Run `pnpm dev`, then open `/` for the M4 character creation flow or `/dev/tracking` for the development tracking lab. Camera access starts only when you press **Enable camera**. The lab shows raw face pose, blendshapes, landmark overlay, inference time, and tracking FPS. It reports confidence as unavailable because this Face Landmarker API does not expose a per-result confidence score. Photos are held in memory and continuous camera frames are not uploaded.

For a built debug version, run `pnpm build:debug` followed by `pnpm preview:debug`. The production build excludes the tracking lab, MediaPipe runtime, model, and WASM assets. The live camera preview is mirrored; the captured-photo review and Blob use the original camera orientation.

## M2 avatar runtime

Run `pnpm dev` and open `/dev/avatar` to inspect the deterministic 3D fixture without a webcam. Select any reference pose, play the complete pose sequence, run the continuous sweep, or adjust semantic sliders. Drag the viewport to orbit around the real 3D head and scroll to zoom. The page reports render FPS, CPU frame times, draw calls, triangles, bounds, applied controls, and fixture nodes. The fixture proves the animation boundary; it is not a personalized generated avatar. The production build excludes Three.js and the avatar lab.

## M3 fal connection

Open `/provider` for the key and connection check. Paste an API-scoped fal key without the `Key ` prefix and press **Use key in this page**, then **Check connection**. The check sends one read-only pricing request directly to fal; it does not execute a model or incur model charges. The key is kept in memory until that check succeeds, then saved in this browser's `localStorage` so refresh can restore it. The input is cleared after entry; once the key is checked and saved, a fixed masked indicator fills the password field without exposing the key. **Clear key** removes both the live and stored copy. No key is needed for automated tests or builds. Camera frames remain local.

If the connection fails, expand **Connection diagnostics**. It records the click, fetch start, HTTP status if received, elapsed time, and a safe browser failure category. The same events appear in DevTools Console. Select **All** in DevTools Network and enable **Preserve log**. Diagnostics intentionally omit the key, headers, payload and raw response. A browser `fetch` failure cannot itself distinguish CORS from DNS or a blocked connection; the browser Console may supply that detail.

## M4 canonical character image

Open `/`, enter your fal key, and press **Check connection** to verify and save it in this browser. A previously checked key appears as fixed password dots after refresh without placing the real key in the field. **Create fal account** opens fal's login/sign-up and API key page in a new tab. Enable the camera and take a photo. Review the unmirrored full-resolution still before clicking **Create character**. That click starts one paid Nano Banana 2 job using the selected still; opening the page, entering the key, checking the connection, enabling the camera and taking a photo do not start a model job. Review the result, regenerate it, go back to the photo or return to the camera. Regeneration starts another paid job. After fal returns a request ID, refreshing this tab resumes checking that job without another generation request. The pending request reference is kept in `sessionStorage`; the selected photo is kept locally in IndexedDB while recovery is needed. Completed results remain in page memory only. In a development/debug build, `/dev/generation` also accepts an image file, shows the versioned prompt and metadata, and can recover an existing Nano Banana 2 edit request by ID using read-only queue requests. M4 produces one front-facing canonical image; additional views and 3D reconstruction are later milestones.

ESLint uses the recommended JavaScript and TypeScript rules. Prettier owns formatting, and Husky checks the staged file contents before each local commit. Run `pnpm format`, then stage the formatted files again before committing. CI runs `pnpm format:check` across the project even when local Git hooks are skipped.

Only non-secret values may use `VITE_` environment variables. The optional `VITE_PROVIDER=fal` setting identifies the provider. Never put a fal key or other credential in `.env` or a `VITE_` variable. A validated user-owned key is stored as plain text in this origin's `localStorage`; scripts with access to the page and other users of the same browser profile can access it. Use **Clear key** on a shared device.

See [STATUS.md](STATUS.md) for milestone status and [docs/adr](docs/adr/) for architectural decisions.
