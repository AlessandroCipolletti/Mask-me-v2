import {
  transformPoint,
  type LandmarkPair,
  type Point3,
  type SimilarityFit,
} from './SimilarityFit';

function kernel(distance: number, radius: number): number {
  const t = Math.max(0, 1 - distance / radius);
  return t * t * t * t * (5 - 4 * t);
}

function solve(matrix: number[][], right: number[]): number[] {
  const n = right.length;
  const a = matrix.map((row, index) => [...row, right[index]!]);
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++)
      if (Math.abs(a[row]![column]!) > Math.abs(a[pivot]![column]!))
        pivot = row;
    if (Math.abs(a[pivot]![column]!) < 1e-10)
      throw new Error('Facial warp landmarks are degenerate.');
    [a[column], a[pivot]] = [a[pivot]!, a[column]!];
    const divisor = a[column]![column]!;
    for (let j = column; j <= n; j++) a[column]![j] = a[column]![j]! / divisor;
    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = a[row]![column]!;
      for (let j = column; j <= n; j++)
        a[row]![j] = a[row]![j]! - factor * a[column]![j]!;
    }
  }
  return a.map((row) => row[n]!);
}

export interface LandmarkWarp {
  readonly supportRadius: number;
  readonly landmarkCount: number;
  readonly residualRms: number;
  transform(point: Point3): Point3;
}

/** Compact local residual fit after a rigid initialization; no mesh topology assumptions. */
export function fitLandmarkWarp(
  pairs: readonly LandmarkPair[],
  rigid: SimilarityFit,
  supportRadius: number,
): LandmarkWarp {
  if (
    pairs.length < 4 ||
    pairs.length > 256 ||
    !Number.isFinite(supportRadius) ||
    supportRadius <= 0
  )
    throw new Error(
      'Facial warp requires 4–256 landmarks and a positive support radius.',
    );
  const centers = pairs.map((pair) => transformPoint(rigid, pair.template));
  const residuals = pairs.map(
    (pair, index) =>
      [
        pair.source[0] - centers[index]![0],
        pair.source[1] - centers[index]![1],
        pair.source[2] - centers[index]![2],
      ] as Point3,
  );
  const matrix = centers.map((a, i) =>
    centers.map(
      (b, j) =>
        kernel(
          Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
          supportRadius,
        ) + (i === j ? 1e-4 : 0),
    ),
  );
  const weights = [0, 1, 2].map((axis) =>
    solve(
      matrix,
      residuals.map((r) => r[axis]!),
    ),
  );
  function transform(point: Point3): Point3 {
    const base = transformPoint(rigid, point);
    const output = [base[0], base[1], base[2]];
    for (let i = 0; i < centers.length; i++) {
      const center = centers[i]!;
      const value = kernel(
        Math.hypot(
          base[0] - center[0],
          base[1] - center[1],
          base[2] - center[2],
        ),
        supportRadius,
      );
      for (let axis = 0; axis < 3; axis++)
        output[axis] = output[axis]! + weights[axis]![i]! * value;
    }
    return output as unknown as Point3;
  }
  let error = 0;
  for (const pair of pairs) {
    const result = transform(pair.template);
    error +=
      (result[0] - pair.source[0]) ** 2 +
      (result[1] - pair.source[1]) ** 2 +
      (result[2] - pair.source[2]) ** 2;
  }
  return {
    supportRadius,
    landmarkCount: pairs.length,
    residualRms: Math.sqrt(error / pairs.length),
    transform,
  };
}
