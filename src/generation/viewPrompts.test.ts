import { describe, expect, it } from 'vitest';
import {
  buildViewPrompt,
  buildViewSystemPrompt,
  VIEW_IDS,
  VIEW_PROMPT_VERSION,
} from './viewPrompts';

describe('M5 view prompts', () => {
  it('defines five distinct angles from one canonical reference', () => {
    expect(VIEW_PROMPT_VERSION).toBe('multiview-v3');
    expect(VIEW_IDS).toEqual([
      'frontLeft45',
      'left90',
      'frontRight45',
      'right90',
      'back180',
    ]);
    const prompts = VIEW_IDS.map(buildViewPrompt);
    expect(new Set(prompts).size).toBe(5);
    for (const prompt of prompts) {
      expect(prompt).toContain(
        'canonical character image as the only visual reference',
      );
      expect(prompt).toContain('entire hair, skull, ears');
      expect(prompt).toContain('same soft studio light');
      expect(prompt).toContain('high-detail dimensional skin and hair');
      expect(prompt).toContain('completely free of visible wrinkles');
      expect(prompt).toContain('under-eye dark circles');
      expect(prompt).toContain('Preserve the exact eye shape');
    }
    expect(prompts[0]).toContain('character’s own left side');
    expect(prompts[1]).toContain('true left profile');
    expect(prompts[2]).toContain('character’s own right side');
    expect(prompts[3]).toContain('true right profile');
    expect(prompts[4]).toContain('complete rear skull');
    expect(prompts[4]).toContain('must not be visible');
    expect(buildViewSystemPrompt()).toContain(
      'Only the virtual camera angle changes',
    );
    expect(buildViewSystemPrompt()).toContain(
      'Keep the skin smooth and wrinkle-free in every view',
    );
    expect(buildViewSystemPrompt()).toContain('fine non-aging material detail');
    expect(buildViewSystemPrompt()).toContain('free of dark circles');
  });
});
