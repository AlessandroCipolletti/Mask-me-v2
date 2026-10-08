# ADR-011 — Use an identity-preserving facial cut boundary

**Status:** Proposed during M8; requires a working automatic fit and visual acceptance before adoption

## Context

ADR-010 selected the ICT FaceKit Light `M_Face` full region as the initial deformable patch because its outer boundary moves less than the narrower region under jaw and lip expressions. M8 rendered that actual 9,409-vertex region as a rigidly aligned wireframe over the confirmed Hunyuan reconstruction. The local eight-feature fit had a `0.0388` normalized-unit RMS landmark residual, sufficient to inspect broad placement but not to claim a final fit.

The full ICT face material region reaches approximately `x ±9.20`, `y −16.47..12.37` in template units. At the measured scale (`0.06993`), it extends well into the identity's beard, ear-side and neck areas. Front and profile overlays visibly pass through the existing facial surface and around these features. Treating this stock region's outer loop as a deletion boundary would replace important personalized geometry with generic template anatomy. The reconstructed ear shape, beard, jaw and neck must remain recognizable.

## Proposed decision

Keep ADR-010's hybrid architecture and ICT Light semantic topology/morph source, but **do not use the stock full-face outer boundary as the source-mesh cut contour**. The builder must derive a per-avatar contour inside the registered face, preserve Hunyuan ears, hair, facial hair and neck where they contribute identity, and adapt/taper template motion toward that contour. Any remaining outer motion must be carried through a measured transition band in the source shell. The neutral fit, expression extremes and seam must pass the quality gate before export.

This is a design constraint for the M8 producer, not a claim that contour extraction and joining have been solved. A failed contour or blend must reject the avatar. The current diagnostic wireframe is not a prepared avatar and cannot be displayed as one.

## Alternatives and evidence

- **Use the full ICT outer loop unchanged:** lower measured boundary displacement, but the real overlay reaches ear-side, beard and neck geometry and risks genericizing the identity.
- **Use the stock narrow loop unchanged:** protects more source geometry, but M7 measured `jawOpen` outer-loop motion of `1.402` template units, about `0.098` normalized avatar units at this fit scale. A fixed seam would tear; even a short transition could visibly deform the beard/jaw.
- **Morph the entire Hunyuan head:** retains source surface but reintroduces the ~183 MB naive morph payload and still lacks eye and oral anatomy.

The overlay is direct browser evidence on **one** real reconstruction. It does not establish that the proposed contour works across identities. More source GLBs and a production fitting/cutting experiment are required.

## Consequences

M8 requires a true local surface cut, template trim/remap, source-texture projection and a deforming transition around a per-avatar boundary. The seam may be harder than ADR-010's original full-loop estimate suggested. The complete-head, identity and facial-quality requirements remain unchanged. If this route fails after a concrete implementation experiment, revisit the facial strategy explicitly rather than shipping a mask overlay.
