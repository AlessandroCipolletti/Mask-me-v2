import { describe, expect, it } from 'vitest';
import { fitLandmarkWarp } from './LandmarkWarp';
import {
  fitLandmarkSimilarity,
  transformPoint,
  type Point3,
} from './SimilarityFit';

describe('local facial landmark warp', () => {
  it('reduces local residuals while leaving distant shell points rigid', () => {
    const template: readonly Point3[] = [
      [-1, 1, 0],
      [1, 1, 0],
      [-1, -1, 0],
      [1, -1, 0],
      [0, 0, 1],
      [0, -0.5, 0.8],
    ];
    const pairs = template.map((point, index) => ({
      template: point,
      source: [
        point[0],
        point[1],
        point[2] + (index === 4 ? 0.12 : 0),
      ] as Point3,
    }));
    const rigid = fitLandmarkSimilarity(pairs);
    const warp = fitLandmarkWarp(pairs, rigid, 1.5);
    expect(warp.residualRms).toBeLessThan(rigid.rmsError);
    expect(warp.residualRms).toBeLessThan(0.001);
    const far: Point3 = [10, 10, 10];
    expect(warp.transform(far)).toEqual(transformPoint(rigid, far));
  });

  it('rejects unusable support settings', () => {
    const point: Point3 = [0, 0, 0];
    const pair = { template: point, source: point };
    const fit = fitLandmarkSimilarity([
      pair,
      { template: [1, 0, 0], source: [1, 0, 0] },
      { template: [0, 1, 0], source: [0, 1, 0] },
      { template: [0, 0, 1], source: [0, 0, 1] },
    ]);
    expect(() => fitLandmarkWarp([pair], fit, 1)).toThrow('4–256');
    expect(() => fitLandmarkWarp([pair, pair, pair, pair], fit, 0)).toThrow(
      'positive',
    );
  });
});
