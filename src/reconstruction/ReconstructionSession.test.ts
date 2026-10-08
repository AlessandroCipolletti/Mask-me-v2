import { describe, expect, it, vi } from 'vitest';
import { emptyViewSet } from '../generation/ViewSetSession';
import { approvedViews } from './fixtures/approvedViews';
import { FalReconstructionProvider } from './FalReconstructionProvider';
import type { ReconstructionResult } from './ReconstructionProvider';
import { ReconstructionSession } from './ReconstructionSession';
import type { ReconstructionRecord } from './ReconstructionRecordStore';

function harness() {
  let record: ReconstructionRecord | null = null;
  let saved: { result: ReconstructionResult; blob: Blob } | null = null;
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
    read: async () => saved,
    save: async (value: { result: ReconstructionResult; blob: Blob }) => {
      saved = value;
    },
    clear: async () => {
      saved = null;
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
    await expect(h.assets.read()).resolves.toMatchObject({
      blob: h.glb,
    });
    expect(h.records.read()?.pending).toBeNull();
    expect(h.records.read()?.result?.metadata.providerRequestId).toBe(
      'known_1',
    );
    expect(download).toHaveBeenCalledTimes(1);
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
});
