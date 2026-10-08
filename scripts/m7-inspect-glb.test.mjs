import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inspectGlbBytes } from './m7-inspect-glb.mjs';

const tetra = readFileSync(
  new URL('../src/reconstruction/fixtures/tetra.glb', import.meta.url),
);

describe('M7 GLB topology probe', () => {
  it('reports the fixture as one closed connected surface', () => {
    expect(inspectGlbBytes(tetra)).toMatchObject({
      vertexCount: 4,
      triangleCount: 4,
      rawComponents: 1,
      weldedComponents: 1,
      rawEdges: { boundary: 0, nonManifold: 0 },
      weldedEdges: { boundary: 0, nonManifold: 0 },
    });
  });

  it('rejects a truncated container before reading accessors', () => {
    expect(() => inspectGlbBytes(tetra.subarray(0, 40))).toThrow(
      'Expected a complete GLB 2.0 container.',
    );
  });
});
