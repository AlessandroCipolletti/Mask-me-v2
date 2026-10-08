import { describe, expect, it, vi } from 'vitest';
import { VerifiedKeyStorage } from './VerifiedKeyStorage';
import { VolatileCredential } from './VolatileCredential';

function setup() {
  const values = new Map<string, string>();
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
  };
  return { values, storage, saved: new VerifiedKeyStorage(storage) };
}

describe('VerifiedKeyStorage', () => {
  it('remains empty until a successful check, then restores without exposing the key in UI state', async () => {
    const { storage, saved } = setup();
    const credential = new VolatileCredential();
    credential.set('fal-secret');
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(
      await saved.verifyAndRemember(
        credential,
        async () => undefined,
        new AbortController().signal,
      ),
    ).toBe(true);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    credential.clear();
    expect(credential.ready).toBe(false);
    expect(saved.restore(credential)).toBe(true);
    expect(credential.ready).toBe(true);
    saved.forget();
    credential.clear();
    expect(saved.restore(credential)).toBe(false);
  });

  it('never saves a failed or cancelled check', async () => {
    const { storage, saved } = setup();
    const credential = new VolatileCredential();
    credential.set('fal-secret');
    await expect(
      saved.verifyAndRemember(
        credential,
        async () => {
          throw new Error('auth failed');
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow('auth failed');
    const controller = new AbortController();
    await expect(
      saved.verifyAndRemember(
        credential,
        async () => {
          controller.abort();
        },
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: 'cancelled' });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('tolerates blocked storage and discards malformed saved values', async () => {
    const credential = new VolatileCredential();
    credential.set('fal-secret');
    const blocked = new VerifiedKeyStorage({
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    });
    expect(blocked.restore(credential)).toBe(false);
    expect(
      await blocked.verifyAndRemember(
        credential,
        async () => undefined,
        new AbortController().signal,
      ),
    ).toBe(false);
    blocked.forget();

    const { values, saved } = setup();
    values.set('avatar-studio.fal-key.v1', 'bad\nkey');
    credential.clear();
    expect(saved.restore(credential)).toBe(false);
    expect(values.size).toBe(0);
  });
});
