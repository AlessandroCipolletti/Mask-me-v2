export interface LandmarkPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface BlendshapeScore {
  readonly name: string;
  readonly score: number;
}

export interface RawHeadPose {
  /** Radians in MediaPipe model coordinates, before M9 camera/avatar conversion. */
  readonly yaw: number;
  readonly pitch: number;
  readonly roll: number;
  readonly translation: readonly [number, number, number];
  /** Row-major 4x4 model-to-camera matrix. */
  readonly matrix: readonly number[];
}

/** Provider-neutral M1 diagnostic data. This is not the future AvatarControlState. */
export interface TrackingObservation {
  readonly timestampMs: number;
  readonly faceDetected: boolean;
  /** This MediaPipe task does not expose a per-result face confidence score. */
  readonly confidence: number | null;
  readonly landmarks: readonly LandmarkPoint[];
  readonly blendshapes: readonly BlendshapeScore[];
  readonly pose: RawHeadPose | null;
}

export function isFaceNearFrameEdge(
  landmarks: readonly LandmarkPoint[],
  margin = 0.1,
): boolean {
  if (landmarks.length === 0) return false;
  return landmarks.some(
    ({ x, y }) => x < margin || x > 1 - margin || y < margin || y > 1 - margin,
  );
}
