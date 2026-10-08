import { MAX_GLB_BYTES, validateGlbContainer } from './GlbContainer';
import type { ReconstructionAsset } from './ReconstructionProvider';

/** Fetch public provider output once; preserve exact bytes for later M7 experiments. */
export async function downloadOriginalGlb(
  asset: ReconstructionAsset,
  signal: AbortSignal,
): Promise<Blob> {
  const url = new URL(asset.url);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('The provider returned an unsafe asset URL.');
  if (asset.fileSize && asset.fileSize > MAX_GLB_BYTES)
    throw new Error('The generated GLB exceeds the browser size limit.');
  const response = await fetch(url, {
    signal,
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok)
    throw new Error(`The GLB download failed (HTTP ${response.status}).`);
  const announced = Number(response.headers.get('content-length'));
  if (announced > MAX_GLB_BYTES)
    throw new Error('The generated GLB exceeds the browser size limit.');
  if (!response.body) {
    // Some Safari responses expose arrayBuffer() without a streaming body.
    const bytes = await response.arrayBuffer();
    validateGlbContainer(bytes);
    return new Blob([bytes], { type: 'model/gltf-binary' });
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_GLB_BYTES)
        throw new Error('The generated GLB exceeds the browser size limit.');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  validateGlbContainer(bytes.buffer);
  return new Blob([bytes], { type: 'model/gltf-binary' });
}
