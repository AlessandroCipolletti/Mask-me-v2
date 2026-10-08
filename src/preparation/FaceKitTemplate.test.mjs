import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFaceKitTemplate } from './FaceKitTemplate';

const path = new URL('./assets/facekit-light-v1.bin', import.meta.url);

describe('pinned ICT FaceKit Light pack', () => {
  it('contains the selected full-face topology, anatomy and semantic deltas', () => {
    const bytes = readFileSync(path);
    const template = parseFaceKitTemplate(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    expect(template.positions.length).toBe(26719 * 3);
    expect(template.faceVertexIds.length).toBe(9409);
    expect(template.groups.M_Face.length / 3).toBe(18460);
    expect(template.groups.M_ScleraLeft.length).toBeGreaterThan(1000);
    expect(template.groups.M_GumsTongue.length).toBeGreaterThan(1000);
    expect(Object.keys(template.morphDeltas)).toHaveLength(23);
    expect(
      template.morphDeltas['jaw.open'].some((value) => Math.abs(value) > 0.1),
    ).toBe(true);
    expect(template.landmarkIds).toHaveLength(68);
  });

  it('rejects a truncated pack', () => {
    const bytes = readFileSync(path);
    const truncated = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength - 16,
    );
    expect(() => parseFaceKitTemplate(truncated)).toThrow('truncated');
  });
});
