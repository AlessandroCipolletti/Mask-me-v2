import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import { describe, expect, it } from 'vitest';
import { mapMediaPipeResult } from './mapMediaPipeResult';

describe('MediaPipe result boundary', () => {
  it('copies landmarks, blendshapes, and matrix pose without inventing confidence', () => {
    const result = {
      faceLandmarks: [[{ x: 0.4, y: 0.3, z: -0.1 }]],
      faceBlendshapes: [
        { categories: [{ categoryName: 'eyeBlinkLeft', score: 0.8 }] },
      ],
      facialTransformationMatrixes: [
        {
          rows: 4,
          columns: 4,
          data: [1, 0, 0, 2, 0, 1, 0, 3, 0, 0, 1, 4, 0, 0, 0, 1],
        },
      ],
    } as FaceLandmarkerResult;

    const observation = mapMediaPipeResult(result, 123);
    expect(observation).toMatchObject({
      timestampMs: 123,
      faceDetected: true,
      confidence: null,
      landmarks: [{ x: 0.4, y: 0.3, z: -0.1 }],
      blendshapes: [{ name: 'eyeBlinkLeft', score: 0.8 }],
      pose: { translation: [2, 3, 4] },
    });
    result.faceLandmarks[0]![0]!.x = 0.9;
    expect(observation.landmarks[0]?.x).toBe(0.4);
  });

  it('represents an absent face without stale pose or blendshapes', () => {
    const result = {
      faceLandmarks: [],
      faceBlendshapes: [],
      facialTransformationMatrixes: [],
    } as FaceLandmarkerResult;
    expect(mapMediaPipeResult(result, 456)).toEqual({
      timestampMs: 456,
      faceDetected: false,
      confidence: null,
      landmarks: [],
      blendshapes: [],
      pose: null,
    });
  });
});
