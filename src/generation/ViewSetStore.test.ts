import { describe, expect, it } from 'vitest';
import type { CharacterGeneration } from './CharacterImageGenerator';
import { emptyViewSet } from './ViewSetSession';
import { ViewSetStore } from './ViewSetStore';

const reference: CharacterGeneration = {
  image: { url: 'https://fal.media/front.png', contentType: 'image/png' },
  metadata: {
    provider: 'fal',
    modelId: 'google/nano-banana-2.1/edit',
    promptVersion: 'canonical-v8',
    finalPrompt: 'front',
    parameters: {},
    sourcePhotoId: 'photo',
    timestamp: '2026-01-01T00:00:00Z',
    providerRequestId: 'front_1',
  },
};

describe('ViewSetStore', () => {
  it('restores the canonical reference and pending view IDs without source bytes or key', () => {
    const values = new Map<string, string>();
    const store = new ViewSetStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    });
    const state = {
      ...emptyViewSet(),
      reference,
      views: {
        ...emptyViewSet().views,
        left90: {
          ...emptyViewSet().views.left90,
          status: 'paused' as const,
          pendingMetadata: {
            provider: 'fal',
            modelId: 'google/nano-banana-2.1/edit',
            promptVersion: 'multiview-v1',
            finalPrompt: 'left profile',
            parameters: {},
            referenceRequestId: 'front_1',
            view: 'left90' as const,
            timestamp: '2026-01-01T01:00:00Z',
            providerRequestId: 'left_1',
          },
        },
      },
    };
    expect(store.write(state)).toBe(true);
    expect(store.read()?.reference).toEqual(reference);
    expect(store.read()?.views.left90.pendingMetadata?.providerRequestId).toBe(
      'left_1',
    );
    expect(JSON.stringify(store.read())).not.toContain('fal-key');
    store.clear();
    expect(store.read()).toBeNull();
  });

  it('rejects malformed stored view URLs', () => {
    const values = new Map<string, string>();
    const store = new ViewSetStore({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    });
    store.write({
      ...emptyViewSet(),
      reference: {
        ...reference,
        image: { ...reference.image, url: 'http://unsafe.test/a.png' },
      },
    });
    expect(store.read()).toBeNull();
  });
});
