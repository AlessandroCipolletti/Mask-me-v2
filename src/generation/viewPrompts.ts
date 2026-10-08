/** Front is the M4 canonical image; these five views complete the six-view set. */
export const VIEW_IDS = [
  'frontLeft45',
  'left90',
  'frontRight45',
  'right90',
  'back180',
] as const;
export type GeneratedViewId = (typeof VIEW_IDS)[number];
export type ViewId = 'front' | GeneratedViewId;
export const VIEW_PROMPT_VERSION = 'multiview-v3';

export const VIEW_LABELS: Readonly<Record<ViewId, string>> = {
  front: 'Front',
  frontLeft45: 'Front-left 45°',
  left90: 'Left profile',
  frontRight45: 'Front-right 45°',
  right90: 'Right profile',
  back180: 'Rear',
};

const VIEW_DIRECTIONS: Readonly<Record<GeneratedViewId, string>> = {
  frontLeft45:
    'Place the virtual camera 45 degrees toward the character’s own left side from the frontal position. Show the left cheek, nose projection, left ear, jaw, side skull and full depth of the hairstyle. The far eye may remain partly visible.',
  left90:
    'Place the virtual camera exactly 90 degrees toward the character’s own left side. Show a true left profile with one eye, nose projection, lips, chin, jawline, left ear, rear skull curve and full hair depth. Do not turn this into a three-quarter view.',
  frontRight45:
    'Place the virtual camera 45 degrees toward the character’s own right side from the frontal position. Show the right cheek, nose projection, right ear, jaw, side skull and full depth of the hairstyle. The far eye may remain partly visible.',
  right90:
    'Place the virtual camera exactly 90 degrees toward the character’s own right side. Show a true right profile with one eye, nose projection, lips, chin, jawline, right ear, rear skull curve and full hair depth. Do not turn this into a three-quarter view.',
  back180:
    'Place the virtual camera exactly 180 degrees behind the character. Show the complete rear skull and hairstyle silhouette, hair length, layering, volume, both ears where the hairstyle allows, and the back of the same small neck section. The face, eyes, nose and mouth must not be visible. Do not invent a second face.',
};

export function buildViewSystemPrompt(): string {
  return [
    'Create a technical multi-view reference sheet one image at a time from the supplied canonical character portrait.',
    'The supplied image is the sole authority for this character. Preserve the same identity, adult or youth facial structure, head and facial proportions, hairstyle, hairline, hair volume and length, ears, facial hair, glasses and other existing accessories, colors, materials, high detail in the eyes and hair, neck boundary, stylization and rendering finish.',
    'Keep the skin smooth and wrinkle-free in every view while retaining nuanced skin color, dimensional shading and fine non-aging material detail. Do not introduce forehead lines, crow’s feet, under-eye creases, mouth or neck wrinkles, age spots, sagging or crepey skin, even when changing the viewing angle. Keep the area beneath the eyes free of dark circles and tired-looking discoloration while preserving the canonical eye and eyelid anatomy.',
    'Only the virtual camera angle changes. Keep the character expression, lighting treatment, framing scale and plain neutral background consistent with the reference. Do not redesign facial anatomy, change age category, add or remove accessories, or simplify material detail.',
  ].join(' ');
}

export function buildViewPrompt(view: GeneratedViewId): string {
  return [
    'Use the supplied front-facing canonical character image as the only visual reference. Render exactly the same complete 3D cartoon head for reconstruction input.',
    VIEW_DIRECTIONS[view],
    'Keep the entire hair, skull, ears where visible, chin and small neck section inside the frame with generous margins. Preserve the same subtle closed-mouth expression where the mouth is visible.',
    'Use the same soft studio light, neutral background, high-detail dimensional skin and hair materials, colors and image framing as the reference. The skin must remain completely free of visible wrinkles, under-eye dark circles and obvious signs of aging without becoming flat or plastic. Preserve the exact eye shape and eyelid contours of the canonical character. No body, scene, props, text, extra people, duplicate features, mirrored facial details or cropped silhouette.',
  ].join(' ');
}
