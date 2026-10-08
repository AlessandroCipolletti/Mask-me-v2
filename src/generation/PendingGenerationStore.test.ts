import { describe, expect, it } from 'vitest';
import { PendingGenerationStore } from './PendingGenerationStore';

function memoryStore() {
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

describe('PendingGenerationStore', () => {
  it('restores only a valid pending request without storing credentials or source bytes', () => {
    const storage = memoryStore();
    const pending = new PendingGenerationStore(storage);
    expect(pending.read()).toBeNull();
    expect(
      pending.write({
        requestId: 'req_123',
        metadata: {
          provider: 'fal',
          modelId: 'fal-ai/nano-banana-2/edit',
          promptVersion: 'v1',
          finalPrompt: 'portrait',
          parameters: {},
          sourcePhotoId: 'capture-1',
          timestamp: '2026-01-01T00:00:00.000Z',
          providerRequestId: 'req_123',
        },
      }),
    ).toBe(true);
    expect(pending.read()?.requestId).toBe('req_123');
    pending.clear();
    expect(pending.read()).toBeNull();
  });

  it('rejects malformed or mismatched stored requests', () => {
    const storage = memoryStore();
    storage.setItem(
      'avatar-studio.pending-generation.v1',
      JSON.stringify({ requestId: 'bad/id', metadata: {} }),
    );
    expect(new PendingGenerationStore(storage).read()).toBeNull();
  });
});
