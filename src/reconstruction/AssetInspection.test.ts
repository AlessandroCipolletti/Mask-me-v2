// @ts-expect-error The browser project intentionally omits Node type packages.
import { readFileSync } from 'node:fs';
// @ts-expect-error The browser project intentionally omits Node type packages.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  inspectScene,
  normalizedScale,
  validateGlbContainer,
} from './AssetInspection';

const fixture = readFileSync(
  fileURLToPath(new URL('./fixtures/tetra.glb', import.meta.url)),
);
const bytes = fixture.buffer.slice(
  fixture.byteOffset,
  fixture.byteOffset + fixture.byteLength,
);

describe('GLB validation and inspection', () => {
  it('parses a local GLB fixture, measures geometry and normalizes a copy', async () => {
    validateGlbContainer(bytes);
    const gltf = await new GLTFLoader().parseAsync(bytes, '');
    const report = inspectScene(gltf.scene, bytes.byteLength);
    expect(report.meshes).toBe(1);
    expect(report.triangles).toBe(4);
    expect(report.bounds).toEqual([2, 2, 2]);
    expect(report.scaleToAvatar).toBeCloseTo(1.2);
    expect(report.missingNormals).toBe(1);
  });

  it('rejects malformed containers and pathological bounds', () => {
    const bad = bytes.slice(0);
    new DataView(bad).setUint32(0, 0, true);
    expect(() => validateGlbContainer(bad)).toThrow();
    expect(() => normalizedScale([0, 1, 1])).toThrow();
    expect(() => normalizedScale([1, 1, Infinity])).toThrow();
  });
});
