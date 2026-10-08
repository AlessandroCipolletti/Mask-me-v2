import { describe, expect, it } from 'vitest';
import { isFaceNearFrameEdge } from './observation';
import { readRawHeadPose } from './pose';

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

describe('raw MediaPipe pose', () => {
  it('extracts rotations and translation from row-major matrices', () => {
    const yaw = Math.PI / 6;
    const matrix = [
      Math.cos(yaw),
      0,
      Math.sin(yaw),
      3,
      0,
      1,
      0,
      4,
      -Math.sin(yaw),
      0,
      Math.cos(yaw),
      5,
      0,
      0,
      0,
      1,
    ];
    const pose = readRawHeadPose(matrix);
    expect(pose?.yaw).toBeCloseTo(yaw);
    expect(pose?.pitch).toBeCloseTo(0);
    expect(pose?.roll).toBeCloseTo(0);
    expect(pose?.translation).toEqual([3, 4, 5]);
  });

  it('normalizes matrix scale and rejects invalid matrices', () => {
    const scaled = [...identity];
    scaled[0] = 2;
    scaled[5] = 2;
    scaled[10] = 2;
    expect(readRawHeadPose(scaled)?.yaw).toBeCloseTo(0);
    expect(readRawHeadPose([Number.NaN, ...identity.slice(1)])).toBe(null);
    expect(readRawHeadPose(identity.slice(0, 15))).toBe(null);
  });
});

describe('framing hint', () => {
  it('warns only when detected facial points approach an image edge', () => {
    expect(isFaceNearFrameEdge([{ x: 0.05, y: 0.5, z: 0 }])).toBe(true);
    expect(isFaceNearFrameEdge([{ x: 0.5, y: 0.5, z: 0 }])).toBe(false);
    expect(isFaceNearFrameEdge([])).toBe(false);
  });
});
