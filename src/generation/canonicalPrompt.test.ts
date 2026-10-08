import { describe, expect, it } from 'vitest';
import {
  buildCanonicalPrompt,
  buildCanonicalSystemPrompt,
  CANONICAL_PROMPT_VERSION,
} from './canonicalPrompt';

describe('canonical prompt', () => {
  it('is stable, versioned product logic with identity and complete-head constraints', () => {
    expect(CANONICAL_PROMPT_VERSION).toBe('canonical-character-v8');
    expect(buildCanonicalPrompt()).toBe(buildCanonicalPrompt());
    const prompt = buildCanonicalPrompt();
    for (const required of [
      'recognizable identity',
      'complete three-dimensional head',
      'both ears',
      'small amount of neck',
      'specific, accurate details',
      'eyelids',
      'eyes as identity-defining features',
      'eye shape, size relative to the face, spacing, vertical position',
      'brow-to-eye distance',
      'Do not enlarge, shift, over-round',
      'fine stylized surface texture',
      'layered volumetric locks',
      'readable strands',
      'single flat skin color',
      'single flat hair color',
      'soft directional key light',
      'very subtle natural closed-mouth smile',
      'slightly more attractive in presentation',
      'Only if the person clearly appears younger than 20 years old',
      'a few years younger',
      'If they appear 20 or older, or their age is uncertain',
      'do not rejuvenate, age up',
      'Never make the person look like a child',
      'Keep the source person’s facial anatomy, skin tone, hair color',
      'No teeth, open mouth, broad grin',
      'plain light neutral background',
      'No scenery',
      'Avoid photorealism',
    ])
      expect(prompt).toContain(required);
    const systemPrompt = buildCanonicalSystemPrompt();
    for (const required of [
      'same visual treatment in every image',
      'medium-detail skin',
      'layered volumetric hair',
      'lighting, camera framing, and stylization consistent',
      'Preserve adult age cues',
      'never make an adult look noticeably younger or older',
      'Avoid flat vector illustration',
    ])
      expect(systemPrompt).toContain(required);
  });
});
