// @ts-expect-error The browser project intentionally omits Node type packages.
import { readFileSync } from 'node:fs';
// @ts-expect-error The browser project intentionally omits Node type packages.
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadOriginalGlb } from './downloadOriginalGlb';

const fixture = readFileSync(
  fileURLToPath(new URL('./fixtures/tetra.glb', import.meta.url)),
);
const asset = {
  url: 'https://fal.media/head.glb',
  contentType: 'model/gltf-binary',
  fileName: 'head.glb',
  fileSize: fixture.byteLength,
};

afterEach(() => vi.unstubAllGlobals());

describe('original GLB download', () => {
  it('preserves exactly the provider bytes through a streaming response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(fixture, { status: 200 })),
    );
    const blob = await downloadOriginalGlb(asset, new AbortController().signal);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(
      new Uint8Array(fixture),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('uses arrayBuffer when a Safari response lacks a streaming body', async () => {
    const bytes = fixture.buffer.slice(
      fixture.byteOffset,
      fixture.byteOffset + fixture.byteLength,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: new Headers(),
        body: null,
        arrayBuffer: async () => bytes,
      })),
    );
    const blob = await downloadOriginalGlb(asset, new AbortController().signal);
    expect(blob.size).toBe(fixture.byteLength);
  });
});
