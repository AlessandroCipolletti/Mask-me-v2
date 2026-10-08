import { describe, expect, it } from 'vitest';
import {
  fitLandmarkSimilarity,
  transformPoint,
  type Point3,
} from './SimilarityFit';

const template: readonly Point3[] = [
  [-4, 3, 8],
  [4, 3, 8],
  [0, 0, 12],
  [-3, -4, 9],
  [3, -4, 9],
  [0, -7, 8],
  [-5, 5, 7],
  [5, 5, 7],
];

describe('3D landmark similarity fit', () => {
  it('recovers rotation, scale and translation from an independent identity frame', () => {
    const yaw = Math.PI / 5;
    const expected = {
      scale: 0.08,
      rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)] as const,
      translation: [0.1, -0.2, 0.4] as const,
    };
    const pairs = template.map((point) => ({
      template: point,
      source: transformPoint(expected, point),
    }));
    const fit = fitLandmarkSimilarity(pairs);
    expect(fit.scale).toBeCloseTo(expected.scale, 6);
    expect(fit.rmsError).toBeLessThan(1e-7);
    expect(fit.maxError).toBeLessThan(1e-7);
    for (const pair of pairs) {
      const mapped = transformPoint(fit, pair.template);
      for (let axis = 0; axis < 3; axis++)
        expect(mapped[axis]).toBeCloseTo(pair.source[axis]!, 6);
    }
  });

  it('rejects degenerate or non-finite data', () => {
    expect(() =>
      fitLandmarkSimilarity(
        template.slice(0, 3).map((p) => ({ template: p, source: p })),
      ),
    ).toThrow('four');
    expect(() =>
      fitLandmarkSimilarity(
        template.map((p) => ({ template: [0, 0, 0] as const, source: p })),
      ),
    ).toThrow('span');
    expect(() =>
      fitLandmarkSimilarity(
        template.map((p) => ({ template: p, source: p, weight: Number.NaN })),
      ),
    ).toThrow('finite');
  });
});
