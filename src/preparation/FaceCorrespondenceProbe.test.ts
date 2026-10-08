import { describe, expect, it } from 'vitest';
import { orientationScore } from './FaceCorrespondenceProbe';

describe('source orientation scoring', () => {
  it('rejects missing face observations', () => {
    expect(
      orientationScore({
        detectedFaces: 0,
        landmarkCount: 0,
        normalizedBounds: null,
        detectedYawRadians: null,
      }),
    ).toBe(0);
  });

  it('prefers a frontal face at the same visible size', () => {
    const front = {
      detectedFaces: 1,
      landmarkCount: 478,
      normalizedBounds: [0.2, 0.2, 0.8, 0.8] as const,
      detectedYawRadians: 0,
    };
    expect(orientationScore(front)).toBeGreaterThan(
      orientationScore({ ...front, detectedYawRadians: 0.8 }),
    );
    expect(orientationScore(front)).toBeGreaterThan(
      orientationScore({ ...front, normalizedBounds: [0.4, 0.4, 0.6, 0.6] }),
    );
  });
});
