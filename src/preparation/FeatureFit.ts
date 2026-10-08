import type { FaceKitTemplate } from './FaceKitTemplate';
import {
  fitLandmarkSimilarity,
  type LandmarkPair,
  type Point3,
  type SimilarityFit,
} from './SimilarityFit';

/** Standard 68-landmark convention published with ICT FaceKit Light. */
const referenceIndices = {
  noseTip: 30,
  leftEyeOuter: 36,
  rightEyeOuter: 45,
  leftMouthCorner: 48,
  rightMouthCorner: 54,
  chin: 8,
  leftBrow: 17,
  rightBrow: 26,
} as const;

/** Initializes registration from visible 3D correspondences; dense fitting follows later. */
export function collectSelectedFaceFeaturePairs(
  template: Pick<FaceKitTemplate, 'positions' | 'landmarkIds'>,
  sourcePoints: Readonly<Record<string, Point3 | null>>,
): readonly LandmarkPair[] {
  const pairs: LandmarkPair[] = [];
  for (const [name, index] of Object.entries(referenceIndices)) {
    const source = sourcePoints[name];
    const vertexId = template.landmarkIds[index];
    if (!source || vertexId === undefined)
      throw new Error(`Missing 3D facial feature ${name}.`);
    const offset = vertexId * 3;
    const point: Point3 = [
      template.positions[offset]!,
      template.positions[offset + 1]!,
      template.positions[offset + 2]!,
    ];
    pairs.push({
      template: point,
      source,
      weight: name === 'noseTip' ? 1.5 : 1,
    });
  }
  return pairs;
}

export function fitSelectedFaceFeatures(
  template: Pick<FaceKitTemplate, 'positions' | 'landmarkIds'>,
  sourcePoints: Readonly<Record<string, Point3 | null>>,
): SimilarityFit {
  return fitLandmarkSimilarity(
    collectSelectedFaceFeaturePairs(template, sourcePoints),
  );
}
