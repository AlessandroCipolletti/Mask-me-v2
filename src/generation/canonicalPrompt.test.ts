import { describe, expect, it } from 'vitest';
import {
  buildCanonicalPrompt,
  CANONICAL_PROMPT_VERSION,
} from './canonicalPrompt';

describe('canonical prompt', () => {
  it('is stable, versioned product logic with identity and complete-head constraints', () => {
    expect(CANONICAL_PROMPT_VERSION).toBe('canonical-character-v3');
    expect(buildCanonicalPrompt()).toBe(buildCanonicalPrompt());
    const prompt = buildCanonicalPrompt();
    for (const required of [
      'recognizable identity',
      'complete three-dimensional head',
      'both ears',
      'small amount of neck',
      'specific, accurate details',
      'eyelids',
      'hair clumps and strands',
      'very subtle natural closed-mouth smile',
      'slightly more attractive in presentation',
      'not by changing facial anatomy, skin tone, age cues',
      'No teeth, open mouth, broad grin',
      'plain light neutral background',
      'No scenery',
      'Avoid photorealism',
    ])
      expect(prompt).toContain(required);
  });
});
