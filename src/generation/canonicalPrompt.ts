/** Product prompt contract. Bump the version whenever output policy changes. */
export const CANONICAL_PROMPT_VERSION = 'canonical-character-v3';

export function buildCanonicalPrompt(): string {
  return [
    'Transform the person in the provided photograph into one original stylized 3D cartoon character portrait.',
    'Preserve their recognizable identity with specific, accurate details: face shape, forehead, cheekbones, jaw and chin, eye spacing and shape, eyebrows, nose, lips, skin tone, hairline, hair color, hairstyle and texture, age cues, and distinctive features. Keep any visible glasses or facial hair faithful to the photograph; do not reshape, average, or replace the person’s features.',
    'Show exactly one person, facing the camera directly, with both eyes open and a very subtle natural closed-mouth smile. Lift the mouth corners only slightly; keep the cheeks and facial proportions close to a relaxed neutral expression. No teeth, open mouth, broad grin, or exaggerated expression.',
    'Include the complete three-dimensional head from the top of all hair through both ears and a small amount of neck. Keep the whole head inside the frame with generous margin; do not crop hair, ears, chin, or neck. Render natural visible ears where the hairstyle permits.',
    'Use a coherent high-quality cartoon sculpt style with clear three-dimensional volumes and carefully resolved small details: defined eyelids, brows, nose, lips, ears, hair clumps and strands, and subtle stylized skin and hair material variation. Preserve natural asymmetry and distinctive marks instead of smoothing them away. Keep clean contours and a front view consistent enough for later multi-view reconstruction.',
    'Give the character a gently flattering, appealing look, slightly more attractive in presentation than a literal rendering of the photo. Achieve this through soft even lighting, neatly resolved hair, gentle color harmony, and polished stylized materials, not by changing facial anatomy, skin tone, age cues, or distinctive features into a generic beauty ideal.',
    'Use a plain light neutral background. No scenery, props, extra people, body, text, logos, watermarks, speech bubbles, dramatic pose, or heavy shadows.',
    'Avoid photorealism, flat illustration, face-filter overlays, exaggerated caricature, and any recognizable studio or franchise style.',
  ].join(' ');
}
