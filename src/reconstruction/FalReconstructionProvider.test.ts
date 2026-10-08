import { describe, expect, it, vi } from 'vitest';
import type { ProviderClient, ProviderJob } from '../provider/ProviderClient';
import {
  FalReconstructionProvider,
  parseFalReconstruction,
  RECONSTRUCTION_MODEL_ID,
} from './FalReconstructionProvider';
import { approvedViews } from './fixtures/approvedViews';

describe('Fal reconstruction adapter', () => {
  it('maps all six approved views to the exact documented v3.1 fields', async () => {
    const jobs: ProviderJob<unknown>[] = [];
    const client: ProviderClient = {
      run: async (job, options) => {
        jobs.push(job);
        options?.onSubmitted?.('recon_1');
        return {
          requestId: 'recon_1',
          data: job.parse({
            model_glb: {
              url: 'https://fal.media/head.glb',
              content_type: 'model/gltf-binary',
              file_size: 1234,
            },
            seed: 42,
          }),
        };
      },
      resume: vi.fn(),
    };
    const provider = new FalReconstructionProvider(
      client,
      () => new Date('2026-01-02T00:00:00Z'),
    );
    const result = await provider.createReconstruction(approvedViews(), {
      signal: new AbortController().signal,
      onPhase: vi.fn(),
      onSubmitted: vi.fn(),
    });
    expect(jobs[0]?.modelId).toBe(RECONSTRUCTION_MODEL_ID);
    expect(jobs[0]?.input).toEqual({
      input_image_url: 'https://fal.media/front.png',
      left_front_image_url: 'https://fal.media/frontLeft45.png',
      left_image_url: 'https://fal.media/left90.png',
      right_front_image_url: 'https://fal.media/frontRight45.png',
      right_image_url: 'https://fal.media/right90.png',
      back_image_url: 'https://fal.media/back180.png',
      generate_type: 'Normal',
      face_count: 500000,
    });
    expect(result.metadata).toMatchObject({
      providerRequestId: 'recon_1',
      seed: 42,
      viewRequestIds: { back180: 'req_back180' },
    });
    expect(JSON.stringify(result)).not.toContain('Key ');
  });

  it('uses GET-only resume and rejects malformed asset output', async () => {
    const run = vi.fn();
    const resume = vi.fn(async (job, id: string) => ({
      requestId: id,
      data: job.parse({ model_glb: { url: 'https://fal.media/existing.glb' } }),
    }));
    const provider = new FalReconstructionProvider({ run, resume });
    const metadata = provider.metadataFor(approvedViews(), 'known_1');
    const result = await provider.getStatus(
      metadata,
      new AbortController().signal,
      vi.fn(),
    );
    expect(result.asset.url).toBe('https://fal.media/existing.glb');
    expect(run).not.toHaveBeenCalled();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(() =>
      parseFalReconstruction({ model_glb: { url: 'javascript:bad' } }),
    ).toThrow();
  });
});
