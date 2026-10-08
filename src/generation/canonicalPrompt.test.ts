import { describe, expect, it } from 'vitest';
import {
  buildCanonicalPrompt,
  CANONICAL_PROMPT_VERSION,
} from './canonicalPrompt';

describe('canonical prompt', () => {
  it('is stable, versioned product logic with identity and complete-head constraints', () => {
    expect(CANONICAL_PROMPT_VERSION).toBe('canonical-character-v1');
    expect(buildCanonicalPrompt()).toBe(buildCanonicalPrompt());
    const prompt = buildCanonicalPrompt();
    for (const required of [
      'recognizable identity',
      'complete three-dimensional head',
      'both ears',
      'small amount of neck',
      'neutral relaxed expression',
      'plain light neutral background',
      'No scenery',
      'Avoid photorealism',
    ])
      expect(prompt).toContain(required);
  });
});
