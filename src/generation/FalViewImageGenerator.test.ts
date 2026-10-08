import { describe, expect, it, vi } from 'vitest';
import type { ProviderClient, ProviderJob } from '../provider/ProviderClient';
import type { CharacterGeneration } from './CharacterImageGenerator';
import { FalViewImageGenerator } from './FalViewImageGenerator';
import { VIEW_IDS } from './viewPrompts';

const reference: CharacterGeneration = {
  image: { url: 'https://fal.media/canonical.png', contentType: 'image/png' },
  metadata: {
    provider: 'fal',
    modelId: 'google/nano-banana-2.1/edit',
    promptVersion: 'canonical-character-v8',
    finalPrompt: 'canonical',
    parameters: {},
    sourcePhotoId: 'capture-1',
    timestamp: '2026-01-01T00:00:00Z',
    providerRequestId: 'canonical_123',
  },
};

describe('FalViewImageGenerator', () => {
  it('submits each angle using only the same canonical image URL', async () => {
    const jobs: ProviderJob<unknown>[] = [];
    const provider: ProviderClient = {
      run: async (job) => {
        jobs.push(job);
        return {
          requestId: `view_${jobs.length}`,
          data: job.parse({
            images: [
              { url: 'https://fal.media/view.png', content_type: 'image/png' },
            ],
          }),
        };
      },
      resume: vi.fn(),
    };
    const generator = new FalViewImageGenerator(
      provider,
      () => new Date('2026-01-01T01:00:00Z'),
    );
    for (const view of VIEW_IDS) {
      const result = await generator.generate(reference, view);
      expect(result.metadata).toMatchObject({
        view,
        referenceRequestId: 'canonical_123',
        promptVersion: 'multiview-v1',
      });
      expect(result.metadata.parameters['system_prompt']).toContain(
        'sole authority',
      );
    }
    for (const job of jobs) {
      const input = job.input as Record<string, unknown>;
      expect(job.modelId).toBe('google/nano-banana-2.1/edit');
      expect(input['image_urls']).toEqual(['https://fal.media/canonical.png']);
      expect(input['num_images']).toBe(1);
    }
  });

  it('recovers with GET-only provider operation and validates output', async () => {
    const run = vi.fn();
    const resume = vi.fn(async (job, requestId: string) => ({
      requestId,
      data: job.parse({ images: [{ url: 'https://fal.media/recovered.png' }] }),
    }));
    const generator = new FalViewImageGenerator({ run, resume });
    const metadata = generator.metadataFor(
      reference,
      'back180',
      'existing_123',
    );
    expect(await generator.recover(metadata)).toMatchObject({
      url: 'https://fal.media/recovered.png',
    });
    expect(run).not.toHaveBeenCalled();
    expect(resume).toHaveBeenCalledTimes(1);
  });
});
