import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import simdLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import simdBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import noSimdLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url';
import noSimdBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url';
import modelUrl from '../tracking/assets/face_landmarker.task?url';
import { readRawHeadPose } from '../tracking/pose';

export interface FaceCorrespondenceProbeResult {
  readonly detectedFaces: number;
  readonly landmarkCount: number;
  readonly normalizedBounds: readonly [number, number, number, number] | null;
  readonly detectedYawRadians: number | null;
  readonly featureCoordinates?: Readonly<
    Record<string, readonly [number, number]>
  >;
}

export interface OrientationCandidate extends FaceCorrespondenceProbeResult {
  readonly sourceYawDegrees: number;
  readonly score: number;
}

export function orientationScore(
  result: FaceCorrespondenceProbeResult,
): number {
  if (!result.normalizedBounds || result.landmarkCount < 468) return 0;
  const [minX, minY, maxX, maxY] = result.normalizedBounds;
  const area = Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
  const frontal =
    result.detectedYawRadians === null
      ? 0.25
      : Math.max(0, 1 - Math.abs(result.detectedYawRadians) / (Math.PI / 2));
  return area * frontal;
}

async function createImageLandmarker(): Promise<FaceLandmarker> {
  const simd = await FilesetResolver.isSimdSupported();
  const fileset = {
    wasmLoaderPath: simd ? simdLoaderUrl : noSimdLoaderUrl,
    wasmBinaryPath: simd ? simdBinaryUrl : noSimdBinaryUrl,
  };
  return await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: new URL(modelUrl, location.origin).href,
      delegate: 'CPU',
    },
    runningMode: 'IMAGE',
    numFaces: 1,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: true,
  });
}

function probeFrame(
  landmarker: FaceLandmarker,
  inspectFrame: (
    inspect: (canvas: HTMLCanvasElement) => FaceCorrespondenceProbeResult,
  ) => FaceCorrespondenceProbeResult,
): FaceCorrespondenceProbeResult {
  return inspectFrame((canvas) => {
    const result = landmarker.detect(canvas);
    const points = result.faceLandmarks[0] ?? [];
    if (!points.length)
      return {
        detectedFaces: 0,
        landmarkCount: 0,
        normalizedBounds: null,
        detectedYawRadians: null,
      };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    return {
      detectedFaces: result.faceLandmarks.length,
      landmarkCount: points.length,
      normalizedBounds: [minX, minY, maxX, maxY],
      detectedYawRadians: result.facialTransformationMatrixes[0]
        ? (readRawHeadPose(result.facialTransformationMatrixes[0].data)?.yaw ??
          null)
        : null,
      featureCoordinates:
        points.length < 468
          ? undefined
          : Object.fromEntries(
              [
                ['noseTip', 1],
                ['leftEyeOuter', 33],
                ['rightEyeOuter', 263],
                ['leftMouthCorner', 61],
                ['rightMouthCorner', 291],
                ['chin', 152],
                ['leftBrow', 70],
                ['rightBrow', 300],
              ].map(([name, index]) => {
                const point = points[index as number]!;
                return [name, [point.x, point.y]];
              }),
            ),
    };
  });
}

/** Diagnostic orientation sweep; the same detector is reused across rendered angles. */
export async function probeRenderedOrientations(preview: {
  getYaw(): number;
  setYaw(degrees: number): void;
  inspectFrame<T>(inspect: (canvas: HTMLCanvasElement) => T): T;
  sampleSurface(x: number, y: number): readonly [number, number, number] | null;
}): Promise<{
  best: OrientationCandidate | null;
  candidates: readonly OrientationCandidate[];
  surfacePoints: Readonly<
    Record<string, readonly [number, number, number] | null>
  > | null;
}> {
  const originalYaw = preview.getYaw();
  const candidates: OrientationCandidate[] = [];
  const landmarker = await createImageLandmarker();
  try {
    for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
      preview.setYaw(yaw);
      const result = probeFrame(landmarker, (inspect) =>
        preview.inspectFrame(inspect),
      );
      candidates.push({
        ...result,
        sourceYawDegrees: yaw,
        score: orientationScore(result),
      });
    }
  } finally {
    preview.setYaw(originalYaw);
    landmarker.close();
  }
  const best = candidates.reduce<OrientationCandidate | null>(
    (previous, current) =>
      current.score > (previous?.score ?? 0) ? current : previous,
    null,
  );
  let surfacePoints: Record<
    string,
    readonly [number, number, number] | null
  > | null = null;
  if (best?.featureCoordinates) {
    try {
      preview.setYaw(best.sourceYawDegrees);
      surfacePoints = Object.fromEntries(
        Object.entries(best.featureCoordinates).map(([name, [x, y]]) => [
          name,
          preview.sampleSurface(x, y),
        ]),
      );
    } finally {
      preview.setYaw(originalYaw);
    }
  }
  return { best, candidates, surfacePoints };
}
