import { describe, expect, it } from 'vitest';
import { FalReconstructionProvider } from './FalReconstructionProvider';
import { approvedViews } from './fixtures/approvedViews';
import { ReconstructionRecordStore } from './ReconstructionRecordStore';

function memory() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe('ReconstructionRecordStore', () => {
  it('restores safe pending metadata and rejects tampered model or URL', () => {
    const storage = memory();
    const store = new ReconstructionRecordStore(storage);
    const provider = new FalReconstructionProvider({
      run: async () => {
        throw Error();
      },
      resume: async () => {
        throw Error();
      },
    });
    const pending = provider.metadataFor(approvedViews(), 'known_123');
    expect(
      store.write({ pending, result: null, accepted: false, yawDegrees: 15 }),
    ).toBe(true);
    expect(store.read()?.pending?.providerRequestId).toBe('known_123');
    storage.setItem(
      'avatar-studio.reconstruction.v1',
      JSON.stringify({
        pending: {
          ...pending,
          inputUrls: {
            ...pending.inputUrls,
            input_image_url: 'javascript:bad',
          },
        },
        result: null,
        accepted: false,
        yawDegrees: 0,
      }),
    );
    expect(store.read()).toBeNull();
  });

  it('restores an alternative-model request and its local comparison index', () => {
    const storage = memory();
    const store = new ReconstructionRecordStore(storage);
    const provider = new FalReconstructionProvider({
      run: async () => {
        throw Error();
      },
      resume: async () => {
        throw Error();
      },
    });
    const pending = provider.metadataFor(
      approvedViews(),
      'tripo_123',
      'tripo3d/h3.1/multiview-to-3d',
    );
    store.write({
      pending,
      result: null,
      accepted: false,
      yawDegrees: 0,
      selectedModelId: 'tripo3d/h3.1/multiview-to-3d',
      history: [],
    });
    expect(store.read()?.pending?.modelId).toBe('tripo3d/h3.1/multiview-to-3d');
    expect(store.read()?.pending?.inputUrls).toEqual({
      front: 'https://fal.media/front.png',
      left90: 'https://fal.media/left90.png',
      back180: 'https://fal.media/back180.png',
      right90: 'https://fal.media/right90.png',
    });
  });
});
