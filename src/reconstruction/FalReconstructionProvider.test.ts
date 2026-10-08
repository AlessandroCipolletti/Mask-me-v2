import { describe, expect, it, vi } from 'vitest';
import type {
  ProviderClient,
  ProviderJob,
  ProviderReadJob,
} from '../provider/ProviderClient';
import {
  FalReconstructionProvider,
  parseFalReconstruction,
  RECONSTRUCTION_MODEL_ID,
} from './FalReconstructionProvider';
import { approvedViews } from './fixtures/approvedViews';

describe('Fal reconstruction adapter', () => {
  it.each([
    {
      modelId: 'tripo3d/h3.1/multiview-to-3d' as const,
      output: { model_urls: { glb: { url: 'https://fal.media/tripo.glb' } } },
      parameter: 'geometry_quality',
    },
    {
      modelId: 'meshy/v7.1/multi-image-to-3d' as const,
      output: { model_glb: { url: 'https://fal.media/meshy.glb' } },
      parameter: 'should_texture',
    },
  ])(
    'maps four ordered views and parses $modelId GLB',
    async ({ modelId, output, parameter }) => {
      const jobs: ProviderJob<unknown>[] = [];
      const client: ProviderClient = {
        run: async (job, options) => {
          jobs.push(job);
          options?.onSubmitted?.('new_request');
          return { requestId: 'new_request', data: job.parse(output) };
        },
        resume: vi.fn(),
      };
      const provider = new FalReconstructionProvider(client);
      const result = await provider.createReconstruction(approvedViews(), {
        modelId,
        signal: new AbortController().signal,
        onPhase: vi.fn(),
        onSubmitted: vi.fn(),
      });
      expect(jobs[0]?.modelId).toBe(modelId);
      expect(jobs[0]?.input).toMatchObject({
        image_urls: [
          'https://fal.media/front.png',
          'https://fal.media/left90.png',
          'https://fal.media/back180.png',
          'https://fal.media/right90.png',
        ],
        [parameter]: modelId.startsWith('tripo') ? 'detailed' : true,
      });
      expect(result.asset.url).toMatch(/\.glb$/);
      expect(result.metadata.modelId).toBe(modelId);
      expect(Object.keys(result.metadata.inputUrls)).toEqual([
        'front',
        'left90',
        'back180',
        'right90',
      ]);
      const resume = vi.fn(async (job, id: string) => ({
        requestId: id,
        data: job.parse(output),
      }));
      const restored = new FalReconstructionProvider({ run: vi.fn(), resume });
      await restored.getStatus(
        result.metadata,
        new AbortController().signal,
        vi.fn(),
      );
      expect(resume).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects a Tripo FBX when no GLB variant is returned', () => {
    expect(() =>
      parseFalReconstruction(
        {
          model_urls: {},
          model_mesh: {
            url: 'https://fal.media/head.fbx',
            file_name: 'head.fbx',
          },
        },
        'tripo3d/h3.1/multiview-to-3d',
      ),
    ).toThrow();
  });
  it('uses the portrait-specific Hi3D model with four named views and parses its GLB', async () => {
    const jobs: ProviderJob<unknown>[] = [];
    const client: ProviderClient = {
      run: async (job, options) => {
        jobs.push(job);
        options?.onSubmitted?.('portrait_1');
        return {
          requestId: 'portrait_1',
          data: job.parse({
            model_mesh: {
              url: 'https://fal.media/portrait.glb',
              file_name: 'portrait.glb',
            },
          }),
        };
      },
      resume: vi.fn(),
    };
    const provider = new FalReconstructionProvider(client);
    const result = await provider.createReconstruction(approvedViews(), {
      modelId: 'hitem3d/hi3d/multi-view-to-3d',
      signal: new AbortController().signal,
      onPhase: vi.fn(),
      onSubmitted: vi.fn(),
    });
    expect(jobs[0]?.input).toEqual({
      front_image_url: 'https://fal.media/front.png',
      left_image_url: 'https://fal.media/left90.png',
      back_image_url: 'https://fal.media/back180.png',
      right_image_url: 'https://fal.media/right90.png',
      model: 'scene-portraitv2.1',
      resolution: '1536pro',
      face_count: 500000,
      enable_texture: true,
      enable_pbr: false,
      export_format: 'glb',
    });
    expect(result.metadata).toMatchObject({
      modelId: 'hitem3d/hi3d/multi-view-to-3d',
      parameters: { model: 'scene-portraitv2.1' },
      inputUrls: {
        front: 'https://fal.media/front.png',
        left90: 'https://fal.media/left90.png',
        back180: 'https://fal.media/back180.png',
        right90: 'https://fal.media/right90.png',
      },
    });
    expect(() =>
      parseFalReconstruction(
        { model_mesh: { url: 'https://fal.media/portrait.obj' } },
        'hitem3d/hi3d/multi-view-to-3d',
      ),
    ).toThrow();
  });
  it('keeps the fast Hi3D preset distinct while using the same fal endpoint for submit and resume', async () => {
    const submittedJobs: ProviderJob<unknown>[] = [];
    const resumedJobs: ProviderReadJob<unknown>[] = [];
    const client: ProviderClient = {
      run: async (job, options) => {
        submittedJobs.push(job);
        options?.onSubmitted?.('fast_1');
        return {
          requestId: 'fast_1',
          data: job.parse({
            model_mesh: { url: 'https://fal.media/fast.glb' },
          }),
        };
      },
      resume: async (job, requestId) => {
        resumedJobs.push(job);
        return {
          requestId,
          data: job.parse({
            model_mesh: { url: 'https://fal.media/fast.glb' },
          }),
        };
      },
    };
    const provider = new FalReconstructionProvider(client);
    const result = await provider.createReconstruction(approvedViews(), {
      modelId: 'hitem3d/hi3d/multi-view-to-3d/fast',
      signal: new AbortController().signal,
      onPhase: vi.fn(),
      onSubmitted: vi.fn(),
    });
    expect(submittedJobs[0]?.modelId).toBe('hitem3d/hi3d/multi-view-to-3d');
    expect(submittedJobs[0]?.input).toMatchObject({
      model: 'scene-portraitv2.1',
      resolution: '1536profast',
      enable_texture: true,
    });
    expect(result.metadata.modelId).toBe('hitem3d/hi3d/multi-view-to-3d/fast');
    expect(result.metadata.parameters['resolution']).toBe('1536profast');
    await provider.getStatus(
      result.metadata,
      new AbortController().signal,
      vi.fn(),
    );
    expect(resumedJobs[0]?.modelId).toBe('hitem3d/hi3d/multi-view-to-3d');
  });
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
