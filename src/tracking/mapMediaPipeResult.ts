import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import type { TrackingObservation } from './observation';
import { readRawHeadPose } from './pose';

/** Copies provider output into the M1 tracking boundary; no MediaPipe objects escape. */
export function mapMediaPipeResult(
  result: FaceLandmarkerResult,
  timestampMs: number,
): TrackingObservation {
  const landmarks = result.faceLandmarks[0] ?? [];
  const blendshapes = result.faceBlendshapes[0]?.categories ?? [];
  const matrix = result.facialTransformationMatrixes[0];

  return {
    timestampMs,
    faceDetected: landmarks.length > 0,
    // FaceLandmarkerResult exposes thresholded detections, not a per-result confidence score.
    confidence: null,
    landmarks: landmarks.map(({ x, y, z }) => ({ x, y, z })),
    blendshapes: blendshapes.map(({ categoryName, score }) => ({
      name: categoryName,
      score,
    })),
    pose: matrix ? readRawHeadPose(matrix.data) : null,
  };
}
