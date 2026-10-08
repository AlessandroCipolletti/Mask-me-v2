# Avatar Studio

Browser-first personalized 3D avatar application. The project is being built one milestone at a time under the supplied specification pack. M0–M5 establish the client, camera, avatar runtime, fal integration and six approved character views. M6 reconstructs and reviews the first raw complete-head GLB. Facial preparation and live animation of generated meshes belong to later milestones.

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

Run `pnpm dev` and open `/dev/avatar` to inspect the deterministic 3D fixture without a webcam. Select any reference pose, play the complete pose sequence, run the continuous sweep, or adjust semantic sliders. Drag the viewport to orbit around the real 3D head and scroll to zoom. The page reports render FPS, CPU frame times, draw calls, triangles, bounds, applied controls, and fixture nodes. The fixture proves the animation boundary; it is not a personalized generated avatar. The production build excludes the avatar lab and loads the M6 Three.js viewer only when needed.

## M3 fal connection

Open `/provider` for the key and connection check. Paste an API-scoped fal key without the `Key ` prefix and press **Use key in this page**, then **Check connection**. The check sends one read-only pricing request directly to fal; it does not execute a model or incur model charges. The key is kept in memory until that check succeeds, then saved in this browser's `localStorage` so refresh can restore it. The input is cleared after entry; once the key is checked and saved, a fixed masked indicator fills the password field without exposing the key. **Clear key** removes both the live and stored copy. No key is needed for automated tests or builds. Camera frames remain local.

If the connection fails, expand **Connection diagnostics**. It records the click, fetch start, HTTP status if received, elapsed time, and a safe browser failure category. The same events appear in DevTools Console. Select **All** in DevTools Network and enable **Preserve log**. Diagnostics intentionally omit the key, headers, payload and raw response. A browser `fetch` failure cannot itself distinguish CORS from DNS or a blocked connection; the browser Console may supply that detail.

## M4 canonical character image

Open `/`, enter your fal key, and press **Check connection** to verify and save it in this browser. A previously checked key appears as fixed password dots after refresh without placing the real key in the field. **Create fal account** opens fal's login/sign-up and API key page in a new tab. Enable the camera and take a photo. Review the unmirrored full-resolution still before clicking **Create character**. That click starts one paid Nano Banana 2.1 job using the selected still; opening the page, entering the key, checking the connection, enabling the camera and taking a photo do not start a model job. Review the result, regenerate it, go back to the photo or return to the camera. Regeneration starts another paid job. After fal returns a request ID, refreshing this tab resumes checking that job without another generation request. The pending request reference is kept in `sessionStorage`; the selected photo is kept locally in IndexedDB while recovery is needed. The completed M4 image remains in page memory until M5 review begins; M5 then saves its URL and view-state metadata in tab-scoped session storage. In a development/debug build, `/dev/generation` also accepts an image file, shows the versioned prompt and metadata, and can recover an existing Nano Banana 2.1 or Nano Banana 2 edit request by ID using read-only queue requests. M4 produces one front-facing canonical image. M5 adds the remaining five angles; M6 uses the approved set for reconstruction.

## M5 multi-view images

After reviewing the canonical image, click **Continue to views**. **Generate five views** explicitly starts five paid edit jobs, with at most two active at a time. Every view uses the same canonical image as its only visual reference. Review the contact sheet and accept each angle, or regenerate one angle without replacing the others. Refresh resumes acknowledged jobs with read-only queue requests; unsent views require another explicit click. `/dev/generation` also accepts an existing public HTTPS canonical image URL for M5 inspection without paying to recreate the M4 image. The reviewed set is the end of M5; no reconstruction request is made until you explicitly click the M6 build action.

## M6 complete-head reconstruction

After accepting all five additional views, click **Build 3D head** to open the reconstruction stage, then click **Build 3D head** there to authorize one paid fal request. Hunyuan 3D Pro v3.1 receives the front, both 45° views, both profiles and rear. The screen shows queue stage without a fabricated percentage. A known request resumes after refresh using status/result GETs; **Pause checking** keeps it recoverable, **Cancel reconstruction** requests best-effort remote cancellation, and **Forget request** explicitly discards an unrecoverable ID. A failed GLB download can retry without another paid model call.

The original GLB is saved in browser IndexedDB when storage permits and can be downloaded with its metadata. The viewer centers/scales only its in-memory copy; the downloaded original remains unchanged. Drag to orbit fully around the head, scroll to zoom, and use **Front alignment** if needed. Inspect face, skull, ears, jaw/chin, volumetric hair and rear silhouette before accepting. A thin shell cannot be accepted. The generated mesh is not yet facially animatable. In `/dev/generation`, **Inspect a local GLB fixture** can open `src/reconstruction/fixtures/tetra.glb` without fal; it is a geometry/parser fixture, not a quality example.

**Start a new character** clears this browser's saved reconstruction assets. Download the original GLB and metadata before resetting if you want to keep them outside this session.

ESLint uses the recommended JavaScript and TypeScript rules. Prettier owns formatting, and Husky checks the staged file contents before each local commit. Run `pnpm format`, then stage the formatted files again before committing. CI runs `pnpm format:check` across the project even when local Git hooks are skipped.

Only non-secret values may use `VITE_` environment variables. The optional `VITE_PROVIDER=fal` setting identifies the provider. Never put a fal key or other credential in `.env` or a `VITE_` variable. A validated user-owned key is stored as plain text in this origin's `localStorage`; scripts with access to the page and other users of the same browser profile can access it. Use **Clear key** on a shared device.

See [STATUS.md](STATUS.md) for milestone status and [docs/adr](docs/adr/) for architectural decisions.
