import { describe, expect, it, vi } from 'vitest';
import type {
  ProviderClient,
  ProviderJob,
  ProviderReadJob,
} from '../provider/ProviderClient';
import { NanoBanana2CharacterGenerator } from './NanoBanana2CharacterGenerator';
import type { SourcePhoto } from './CharacterImageGenerator';

const source: SourcePhoto = {
  id: 'capture-1',
  blob: new Blob(['pixels'], { type: 'image/jpeg' }),
  width: 1280,
  height: 720,
};

describe('NanoBanana2CharacterGenerator', () => {
  it('builds one canonical edit job and records safe metadata', async () => {
    const recordJob = vi.fn((job: ProviderJob<unknown>) => job);
    const provider: ProviderClient = {
      resume: async () => {
        throw new Error('not used');
      },
      run: async <T>(job: ProviderJob<T>) => {
        recordJob(job);
        return {
          data: job.parse({
            images: [
              {
                url: 'https://fal.media/result.png',
                content_type: 'image/png',
                width: 1024,
                height: 1280,
              },
            ],
          }),
          requestId: 'req_42',
        };
      },
    };
    const generator = new NanoBanana2CharacterGenerator(
      provider,
      async () => 'data:image/jpeg;base64,ZmFrZQ==',
      () => new Date('2026-01-01T00:00:00Z'),
    );
    const result = await generator.generate(source);
    expect(recordJob).toHaveBeenCalledTimes(1);
    expect(recordJob.mock.calls[0]?.[0]).toMatchObject({
      modelId: 'fal-ai/nano-banana-2/edit',
      input: {
        image_urls: ['data:image/jpeg;base64,ZmFrZQ=='],
        num_images: 1,
        aspect_ratio: '4:5',
        output_format: 'png',
        resolution: '2K',
        limit_generations: true,
      },
    });
    expect(result.image).toEqual({
      url: 'https://fal.media/result.png',
      contentType: 'image/png',
      width: 1024,
      height: 1280,
    });
    expect(result.metadata).toMatchObject({
      provider: 'fal',
      modelId: 'fal-ai/nano-banana-2/edit',
      promptVersion: 'canonical-character-v1',
      sourcePhotoId: 'capture-1',
      providerRequestId: 'req_42',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    expect(JSON.stringify(result.metadata)).not.toContain('ZmFrZQ');
  });

  it('rejects malformed or unsafe output URLs', async () => {
    for (const output of [
      { images: [] },
      { images: [{ url: 'http://example.test/x', content_type: 'image/png' }] },
      {
        images: [{ url: 'https://example.test/x', content_type: 'text/html' }],
      },
    ]) {
      const provider: ProviderClient = {
        resume: async () => {
          throw new Error('not used');
        },
        run: async (job) => ({ data: job.parse(output), requestId: 'req' }),
      };
      const generator = new NanoBanana2CharacterGenerator(
        provider,
        async () => 'data:image/jpeg;base64,eA==',
      );
      await expect(generator.generate(source)).rejects.toMatchObject({
        code: 'invalid_response',
      });
    }
  });

  it('rejects empty source before calling provider', async () => {
    const run = vi.fn();
    const generator = new NanoBanana2CharacterGenerator(
      {
        run,
        resume: async () => {
          throw new Error('not used');
        },
      },
      async () => 'unused',
    );
    await expect(
      generator.generate({
        ...source,
        blob: new Blob([], { type: 'image/jpeg' }),
      }),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    expect(run).not.toHaveBeenCalled();
  });

  it('recovers an existing image through a read-only provider request', async () => {
    const run = vi.fn();
    const called = vi.fn((requestId: string) => requestId);
    const resume = async <T>(job: ProviderReadJob<T>, requestId: string) => {
      called(requestId);
      return {
        data: job.parse({
          images: [
            {
              url: 'https://fal.media/existing.png',
              content_type: 'image/png',
            },
          ],
        }),
        requestId,
      };
    };
    const generator = new NanoBanana2CharacterGenerator({ run, resume });
    expect(await generator.recover('existing_123')).toEqual({
      url: 'https://fal.media/existing.png',
      contentType: 'image/png',
    });
    expect(run).not.toHaveBeenCalled();
    expect(called).toHaveBeenCalledExactlyOnceWith('existing_123');
  });

  it('accepts fal images whose optional dimensions are null', async () => {
    const run = vi.fn();
    const resume = async <T>(job: ProviderReadJob<T>, requestId: string) => ({
      data: job.parse({
        images: [
          {
            url: 'https://v3b.fal.media/files/b/result.png',
            content_type: 'image/png',
            file_name: 'result.png',
            file_size: null,
            width: null,
            height: null,
          },
        ],
        description: '',
      }),
      requestId,
    });
    const generator = new NanoBanana2CharacterGenerator({ run, resume });
    expect(await generator.recover('existing_123')).toEqual({
      url: 'https://v3b.fal.media/files/b/result.png',
      contentType: 'image/png',
    });
    expect(run).not.toHaveBeenCalled();
  });
});
