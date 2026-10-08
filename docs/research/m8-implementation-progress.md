# M8 implementation evidence and remaining gates

**State:** In progress. This record is not an M8 completion or a prepared personalized avatar.

## Real source check

The accepted M6 file `/Users/cippo/Downloads/original-reconstruction.glb` was loaded locally in `/dev/generation` on 2026-10-08. The browser parsed its 35,563,736 bytes, one mesh, 457,430 triangles, one textured material, and finite world bounds of approximately `0.717 × 0.856 × 0.538` source units. The orbit viewer showed a complete textured head, volumetric hair, ears, beard, neck and upper torso. No provider request was made. This visual check does not establish a fit, facial anatomy, or animation quality.

The original has one continuous visual surface with no semantic facial components or morphs (see the M7 research record). Its 4096² UV texture is fragmented across many face, hair and garment islands. A generic face mesh cannot simply be placed over it: the original facial surface would intersect or remain visible; the face texture would not follow the new topology; and moving the patch outer boundary would tear against a static shell. These are concrete work items for the automatic builder and its rejection gate.

The official MIT-licensed ICT FaceKit Light source was inspected again in a temporary checkout at `/private/tmp/ict-facekit-m8`. It has fixed topology and named expressions. A compact, versioned Light template pack and the license notice are now in the repository; the complete upstream checkout and the differently licensed Full model are not. No prepared personalized output has been generated from it.

An M8-only local orientation probe renders eight yaw angles and reuses one image-mode Face Landmarker instance. On this GLB, yaw `0°` detected 478 landmarks with a near-frontal pose (`−0.0005` radians) and score `0.1289`; `45°` and `315°` also detected a face but scored `0.0719` and `0.0677`, while rear and true profiles had no detection. Eight selected image landmarks were raycast onto the real mesh: nose, both outer eye corners, both mouth corners, chin and brows all returned finite front-surface coordinates. This is concrete evidence that **this one model** supports image-to-surface landmarks. It does not validate a full semantic correspondence set, eye contours, another identity, face segmentation or a fitted template. The local probe makes no network request.

The exact MIT Light checkout at commit `da5f95a607f5e6b37755b38d3385d7f2853732e5` was packed into a 3.58 MB binary template with 26,719 neutral vertices, the 9,409-vertex full-face region, 68 published template landmarks, 23 selected semantic expression deltas, eyes, gums/tongue and teeth material groups. Its SHA-256 is `50acc0d54bc140f8ffd9e2d38646b78a1825543456b039bd42d2e127cdeafa2d`; the original MIT notice is in `docs/licenses/ICT-FaceKit-LICENSE`. The loader checks this fingerprint and topology. Using the eight lifted Hunyuan features against the corresponding template landmarks, a weighted similarity fit gave scale `0.06993`, RMS residual `0.0388` and maximum residual `0.0620` in normalized avatar units. This is a credible rigid **initialization**, not a finished nonrigid fit or a quality score for the resulting face.

The debug viewer rendered the rigidly fitted ICT `M_Face` as a wireframe on the textured Hunyuan head from front and profile. It revealed a material constraint: the stock full-face region reaches into beard, ear-side and neck territory and intersects the original surface. It cannot be cut into the source as-is while preserving those identity features. [ADR-011](../adr/011-m8-identity-preserving-face-boundary.md) records a proposed identity-aware contour within the fitted region; it remains unvalidated. The wireframe is a fit diagnostic only and never a prepared output.

A compactly supported eight-point residual warp was added as another diagnostic. It reduces the measured residual at those **same eight fitted points** to `0.000013` normalized units by construction, but the front overlay still visibly intersects the source around the nose and ear-side. This number is an interpolation check, not an identity or seam quality score. Dense surface correspondences, landmark confidence, silhouette protection and a physical cut are still required.

## Implemented boundary

- `PreparedAvatarManifest` v1 defines source and derived GLB fingerprints, canonical axes, anatomy nodes, 23 semantic facial control bindings and preparation diagnostics. Parsing rejects missing or ambiguous bindings and malformed metrics.
- `PreparedAvatarRig` checks the derived GLB fingerprint and actual node/morph availability, then applies `AvatarControlState` to the full head, eyes, jaw and face morphs. It releases geometry, materials and textures on disposal. It has no MediaPipe or Hunyuan topology dependency.
- `/dev/avatar` accepts a local prepared GLB plus manifest and retains the M2 known-good fixture. The synthetic pose controls are shared. A deterministic glTF fixture verifies independent head, blink, eye and jaw application without a webcam or fal call.

This is the **consumer** side of M8. The arbitrary-mesh preparation **producer** is not implemented. The manifest's diagnostic values do not prove visual quality; they must come from measured builder results and still need human review.

## Remaining hard gates

1. For each independent source GLB, establish a reliable facial coordinate frame and correspondences from visual/geometry evidence. A selected M6 preview yaw is not an automatic registration algorithm.
2. Fit the ICT full-face neutral shape to that identity's stylized eye spacing, nose, lips, cheek, jaw and chin without changing hair, ears, rear silhouette or facial hair improperly.
3. Remove the covered original surface, create genuine eye/mouth openings, join the fitted face to the shell through a moving transition, and transfer/bake its appearance with normal continuity.
4. Place and fit independent eyeballs, eyelids, mouth interior, upper/lower teeth and a tongue-compatible volume. Validate neutral and extreme expressions from front, profiles and rear.
5. Export and retain the original plus a derived WebGL2 GLB/manifest and intermediate diagnostics. Reject low-confidence, intersecting or visibly broken results.
6. Prove the automatic pipeline on multiple independently generated identities. Only the one confirmed M6 GLB is currently available locally. Another distinct source is needed for the milestone exit test.
7. Measure browser runtime and inspect the generated asset in Safari and Chrome. This is a manual acceptance check after a real prepared asset exists.

No M9 tracking interpretation or webcam-to-avatar mapping has been started.
