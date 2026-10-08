import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import simdLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import simdBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import noSimdLoaderUrl from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url';
import noSimdBinaryUrl from '@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url';
import modelUrl from './assets/face_landmarker.task?url';
import type { Detector } from './FaceTracker';
import { mapMediaPipeResult } from './mapMediaPipeResult';

export async function createMediaPipeDetector(): Promise<Detector> {
  const simd = await FilesetResolver.isSimdSupported();
  const fileset = {
    wasmLoaderPath: simd ? simdLoaderUrl : noSimdLoaderUrl,
    wasmBinaryPath: simd ? simdBinaryUrl : noSimdBinaryUrl,
  };
  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: new URL(modelUrl, location.origin).href,
      delegate: 'CPU',
    },
    runningMode: 'VIDEO',
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });

  return {
    detect(video, timestampMs) {
      return mapMediaPipeResult(
        landmarker.detectForVideo(video, timestampMs),
        timestampMs,
      );
    },
    close() {
      landmarker.close();
    },
  };
}
