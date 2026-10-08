/** Product prompt contract. Bump the version whenever output policy changes. */
export const CANONICAL_PROMPT_VERSION = 'canonical-character-v1';

export function buildCanonicalPrompt(): string {
  return [
    'Transform the person in the provided photograph into one original stylized 3D cartoon character portrait.',
    'Preserve their recognizable identity: facial proportions, skin tone, hair color, hairstyle and texture, age cues, and distinctive features. Keep any visible glasses or facial hair faithful to the photograph.',
    'Show exactly one person, facing the camera directly, with a neutral relaxed expression, eyes open and mouth closed.',
    'Include the complete three-dimensional head from the top of all hair through both ears and a small amount of neck. Keep the whole head inside the frame with generous margin; do not crop hair, ears, chin, or neck. Render natural visible ears where the hairstyle permits.',
    'Use a coherent high-quality cartoon sculpt style with clear volumes, clean contours, soft even lighting, and readable facial features. Keep the front view symmetric enough for later multi-view reconstruction without erasing the person’s identity.',
    'Use a plain light neutral background. No scenery, props, extra people, body, text, logos, watermarks, speech bubbles, dramatic pose, or heavy shadows.',
    'Avoid photorealism, flat illustration, face-filter overlays, exaggerated caricature, and any recognizable studio or franchise style.',
  ].join(' ');
}
