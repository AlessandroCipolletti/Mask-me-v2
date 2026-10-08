/** Product prompt contract. Bump the version whenever output policy changes. */
export const CANONICAL_PROMPT_VERSION = 'canonical-character-v8';

/** Stable visual policy for Nano Banana 2.1's separate system instruction. */
export function buildCanonicalSystemPrompt(): string {
  return [
    'Create a consistent series of personalized, front-facing 3D cartoon character portraits from reference photographs.',
    'Use the same visual treatment in every image: a polished dimensional CG character sculpt, medium-detail skin with gentle tonal variation and subtle surface texture, layered volumetric hair with individually readable groups and strands, softly defined facial planes, and natural material highlights.',
    'Use one soft directional studio key light with gentle fill, restrained shadows, and a plain light neutral background. Keep the level of detail, material finish, lighting, camera framing, and stylization consistent across subjects and retries.',
    'The reference photograph determines the person’s identity and apparent age. Preserve adult age cues and natural skin character; never make an adult look noticeably younger or older. Apply only the explicitly requested under-20 exception in the edit instruction. Do not substitute a generic attractive face.',
    'Avoid flat vector illustration, cel shading, simplified color blocks, plastic skin, helmet-like hair, photorealism, and exaggerated cartoon proportions.',
  ].join(' ');
}

export function buildCanonicalPrompt(): string {
  return [
    'Transform the person in the provided photograph into one original stylized 3D cartoon character portrait.',
    'Preserve their recognizable identity with specific, accurate details: face shape, forehead, cheekbones, jaw and chin, eye spacing and shape, eyebrows, nose, lips, skin tone, hairline, hair color, hairstyle and texture, overall age range, and distinctive features. Keep any visible glasses or facial hair faithful to the photograph; do not reshape, average, or replace the person’s features.',
    'Pay special attention to the eyes as identity-defining features. Match the source person’s eye shape, size relative to the face, spacing, vertical position, natural tilt, eyelid opening and folds, brow-to-eye distance, and visible iris color. Keep both eyes naturally aligned and looking toward the camera while preserving real asymmetry. Do not enlarge, shift, over-round, or make the eyes generically cute or identical for attractiveness.',
    'Show exactly one person, facing the camera directly, with both eyes open and a very subtle natural closed-mouth smile. Lift the mouth corners only slightly; keep the cheeks and facial proportions close to a relaxed neutral expression. No teeth, open mouth, broad grin, or exaggerated expression.',
    'Treat the apparent age visible in the source photograph as part of this person’s identity. Only if the person clearly appears younger than 20 years old, depict the same person a few years younger with a subtly fresher, rested look. If they appear 20 or older, or their age is uncertain, keep the same apparent age: do not rejuvenate, age up, add or remove wrinkles, or change adult facial fullness. Never make the person look like a child. Preserve natural skin character, distinguishing marks, and facial proportions in every case.',
    'Include the complete three-dimensional head from the top of all hair through both ears and a small amount of neck. Keep the whole head inside the frame with generous margin; do not crop hair, ears, chin, or neck. Render natural visible ears where the hairstyle permits.',
    'Render the character in the consistent dimensional CG style specified above, with clear three-dimensional head volumes and carefully resolved eyelids, brows, nose, lips, ears, and facial hair where present. Preserve natural asymmetry and distinctive marks instead of smoothing them away. Keep clean contours and a front view consistent enough for later multi-view reconstruction.',
    'Give the skin subtle region-specific color variation, softly modeled planes, and fine stylized surface texture that retains visible identity details from the photograph. Avoid a single flat skin color, airbrushed plastic skin, or invented freckles and marks. Where hair is present, render layered volumetric locks with readable strands, natural strand breakup, gentle root-to-tip tonal variation, and controlled highlights that follow the photographed hairstyle. Avoid a smooth helmet-like hair mass or a single flat hair color.',
    'Give the character a gently flattering, appealing look, slightly more attractive in presentation than a literal rendering of the photo. Use a soft directional key light with gentle fill and restrained shadows around the eyes, nose, ears, hair layers, and neck so the materials and forms remain legible. Keep the source person’s facial anatomy, skin tone, hair color, and distinctive features; do not replace them with a generic beauty ideal.',
    'Use a plain light neutral background. No scenery, props, extra people, body, text, logos, watermarks, speech bubbles, dramatic pose, or heavy shadows.',
    'Avoid photorealism, flat illustration, face-filter overlays, exaggerated caricature, and any recognizable studio or franchise style.',
  ].join(' ');
}
