import { describe, expect, it, vi } from 'vitest';
import { emptyViewSet } from '../generation/ViewSetSession';
import { ProviderError } from '../provider/ProviderError';
import { approvedViews } from './fixtures/approvedViews';
import { FalReconstructionProvider } from './FalReconstructionProvider';
import type { ReconstructionResult } from './ReconstructionProvider';
import { ReconstructionSession } from './ReconstructionSession';
import type { ReconstructionRecord } from './ReconstructionRecordStore';

function harness() {
  let record: ReconstructionRecord | null = null;
  const saved = new Map<string, { result: ReconstructionResult; blob: Blob }>();
  const records = {
    read: () => record,
    write: (value: ReconstructionRecord) => {
      record = value;
      return true;
    },
    clear: () => {
      record = null;
    },
  };
  const assets = {
    read: async (requestId: string) => saved.get(requestId) ?? null,
    save: async (value: { result: ReconstructionResult; blob: Blob }) => {
      saved.set(value.result.metadata.providerRequestId, value);
    },
    remove: async (requestId: string) => {
      saved.delete(requestId);
    },
    clear: async () => {
      saved.clear();
    },
  };
  const glb = new Blob(['fixture'], { type: 'model/gltf-binary' });
  return { records, assets, glb };
}

describe('ReconstructionSession', () => {
  it('requires approved views, stores acknowledged ID, then preserves original output bytes', async () => {
    const h = harness();
    const run = vi.fn(async (job, options) => {
      options?.onSubmitted?.('known_1');
      expect(h.records.read()?.pending?.providerRequestId).toBe('known_1');
      return {
        requestId: 'known_1',
        data: job.parse({ model_glb: { url: 'https://fal.media/head.glb' } }),
      };
    });
    const provider = new FalReconstructionProvider({ run, resume: vi.fn() });
    const download = vi.fn(async () => h.glb);
    const session = new ReconstructionSession(
      provider,
      h.records,
      h.assets,
      undefined,
      download,
    );
    await session.create(emptyViewSet());
    expect(run).not.toHaveBeenCalled();
    await session.create(approvedViews());
    expect(run).toHaveBeenCalledTimes(1);
    expect(session.state.status).toBe('ready');
    expect(session.state.savedLocally).toBe(true);
    await expect(h.assets.read('known_1')).resolves.toMatchObject({
      blob: h.glb,
    });
    expect(h.records.read()?.pending).toBeNull();
    expect(h.records.read()?.result?.metadata.providerRequestId).toBe(
      'known_1',
    );
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('preserves separately paid results and reopens local GLBs without another provider call', async () => {
    const h = harness();
    let next = 0;
    const run = vi.fn(async (job, options) => {
      const id = `request_${++next}`;
      options?.onSubmitted?.(id);
      return {
        requestId: id,
        data: job.parse(
          next === 1
            ? { model_glb: { url: 'https://fal.media/first.glb' } }
            : { model_urls: { glb: { url: 'https://fal.media/second.glb' } } },
        ),
      };
    });
    const provider = new FalReconstructionProvider({ run, resume: vi.fn() });
    const session = new ReconstructionSession(
      provider,
      h.records,
      h.assets,
      undefined,
      async () => h.glb,
    );
    await session.create(approvedViews());
    session.selectModel('tripo3d/h3.1/multiview-to-3d');
    await session.create(approvedViews());
    expect(session.state.history).toHaveLength(2);
    expect(session.state.result?.metadata.modelId).toBe(
      'tripo3d/h3.1/multiview-to-3d',
    );
    await session.showHistory('request_1');
    expect(session.state.result?.metadata.modelId).toBe(
      'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d',
    );
    expect(session.state.blob).toBe(h.glb);
    expect(run).toHaveBeenCalledTimes(2);
    const restored = new ReconstructionSession(
      provider,
      h.records,
      h.assets,
      undefined,
      async () => h.glb,
    );
    await restored.restore();
    expect(restored.state.history).toHaveLength(2);
    expect(restored.state.selectedModelId).toBe('tripo3d/h3.1/multiview-to-3d');
  });

  it('discards only the selected mesh, leaves approved views reusable, and restores an empty page', async () => {
    const h = harness();
    let next = 0;
    const run = vi.fn(async (job, options) => {
      const id = `request_${++next}`;
      options?.onSubmitted?.(id);
      return {
        requestId: id,
        data: job.parse({ model_glb: { url: `https://fal.media/${id}.glb` } }),
      };
    });
    const session = new ReconstructionSession(
      new FalReconstructionProvider({ run, resume: vi.fn() }),
      h.records,
      h.assets,
      undefined,
      async () => h.glb,
    );
    await session.create(approvedViews());
    await session.create(approvedViews());
    expect(session.state.history).toHaveLength(2);
    await session.discardCurrent();
    expect(session.state).toMatchObject({
      status: 'idle',
      result: null,
      blob: null,
      accepted: false,
      savedLocally: false,
    });
    expect(session.state.history).toHaveLength(1);
    expect(await h.assets.read('request_2')).toBeNull();
    expect(await h.assets.read('request_1')).not.toBeNull();
    expect(run).toHaveBeenCalledTimes(2);
    await session.showHistory('request_1');
    expect(session.state.result?.metadata.providerRequestId).toBe('request_1');
    await session.discardCurrent();
    expect(session.state.history).toHaveLength(0);
    expect(h.records.read()).toBeNull();
    await session.create(approvedViews());
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('keeps the current result if browser storage cannot delete it', async () => {
    const h = harness();
    const provider = new FalReconstructionProvider({
      run: async (job, options) => {
        options?.onSubmitted?.('request_1');
        return {
          requestId: 'request_1',
          data: job.parse({ model_glb: { url: 'https://fal.media/head.glb' } }),
        };
      },
      resume: vi.fn(),
    });
    const session = new ReconstructionSession(
      provider,
      h.records,
      {
        ...h.assets,
        remove: async () => {
          throw new Error('storage blocked');
        },
      },
      undefined,
      async () => h.glb,
    );
    await session.create(approvedViews());
    await session.discardCurrent();
    expect(session.state.result?.metadata.providerRequestId).toBe('request_1');
    expect(session.state.status).toBe('ready');
    expect(session.state.error).toContain('Could not delete');
  });

  it('resumes an acknowledged request with reads only after refresh', async () => {
    const h = harness();
    const run = vi.fn();
    const resume = vi.fn(async (job, id: string) => ({
      requestId: id,
      data: job.parse({
        model_glb: { url: 'https://fal.media/recovered.glb' },
      }),
    }));
    const provider = new FalReconstructionProvider({ run, resume });
    h.records.write({
      pending: provider.metadataFor(approvedViews(), 'known_2'),
      result: null,
      accepted: false,
      yawDegrees: 0,
    });
    const session = new ReconstructionSession(
      provider,
      h.records,
      h.assets,
      undefined,
      async () => h.glb,
    );
    await session.restore();
    expect(session.state.status).toBe('paused');
    await session.resume();
    expect(run).not.toHaveBeenCalled();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(session.state.result?.asset.url).toBe(
      'https://fal.media/recovered.glb',
    );
  });

  it('retains a provider result when download fails and retries without another paid submit', async () => {
    const h = harness();
    const run = vi.fn(async (job, options) => {
      options?.onSubmitted?.('known_3');
      return {
        requestId: 'known_3',
        data: job.parse({ model_glb: { url: 'https://fal.media/head.glb' } }),
      };
    });
    const provider = new FalReconstructionProvider({ run, resume: vi.fn() });
    let attempts = 0;
    const session = new ReconstructionSession(
      provider,
      h.records,
      h.assets,
      undefined,
      async () => {
        if (++attempts === 1) throw new Error('CORS download blocked');
        return h.glb;
      },
    );
    await session.create(approvedViews());
    expect(session.state.status).toBe('asset_error');
    expect(session.state.result?.metadata.providerRequestId).toBe('known_3');
    await session.retryDownload();
    expect(session.state.status).toBe('ready');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('preserves the known job after a terminal downstream failure', async () => {
    const h = harness();
    const run = vi.fn(async (_job, options) => {
      options?.onSubmitted?.('known_failed');
      throw new ProviderError('downstream_unavailable', 504, false);
    });
    const provider = new FalReconstructionProvider({ run, resume: vi.fn() });
    const session = new ReconstructionSession(provider, h.records, h.assets);
    await session.create(approvedViews());
    expect(session.state.status).toBe('paused');
    expect(session.state.pending?.providerRequestId).toBe('known_failed');
    expect(session.state.error).toContain('check billing');
    expect(h.records.read()?.pending?.providerRequestId).toBe('known_failed');
    expect(run).toHaveBeenCalledTimes(1);
  });
});
