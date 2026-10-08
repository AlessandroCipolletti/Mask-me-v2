export type Point3 = readonly [number, number, number];
export type Quaternion4 = readonly [number, number, number, number];

export interface LandmarkPair {
  readonly template: Point3;
  readonly source: Point3;
  readonly weight?: number;
}

export interface SimilarityFit {
  readonly scale: number;
  readonly rotation: Quaternion4;
  readonly translation: Point3;
  readonly rmsError: number;
  readonly maxError: number;
  readonly landmarkCount: number;
}

export function transformPoint(
  fit: Pick<SimilarityFit, 'scale' | 'rotation' | 'translation'>,
  point: Point3,
): Point3 {
  const [qx, qy, qz, qw] = fit.rotation;
  const [x, y, z] = point;
  const ux = qy * z - qz * y;
  const uy = qz * x - qx * z;
  const uz = qx * y - qy * x;
  const vx = qy * uz - qz * uy;
  const vy = qz * ux - qx * uz;
  const vz = qx * uy - qy * ux;
  return [
    fit.scale * (x + 2 * (qw * ux + vx)) + fit.translation[0],
    fit.scale * (y + 2 * (qw * uy + vy)) + fit.translation[1],
    fit.scale * (z + 2 * (qw * uz + vz)) + fit.translation[2],
  ];
}

/** Largest eigenvector of a symmetric 4×4 Horn matrix via Jacobi rotations. */
function largestQuaternion(matrix: number[][]): Quaternion4 {
  const a = matrix.map((row) => row.slice());
  const vectors = [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
  for (let sweep = 0; sweep < 64; sweep++) {
    let p = 0,
      q = 1,
      largest = 0;
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) {
        const magnitude = Math.abs(a[i]![j]!);
        if (magnitude > largest) {
          largest = magnitude;
          p = i;
          q = j;
        }
      }
    if (largest < 1e-12) break;
    const angle = 0.5 * Math.atan2(2 * a[p]![q]!, a[q]![q]! - a[p]![p]!);
    const c = Math.cos(angle),
      s = Math.sin(angle);
    const app = a[p]![p]!,
      aqq = a[q]![q]!,
      apq = a[p]![q]!;
    a[p]![p] = c * c * app - 2 * c * s * apq + s * s * aqq;
    a[q]![q] = s * s * app + 2 * c * s * apq + c * c * aqq;
    a[p]![q] = a[q]![p] = 0;
    for (let k = 0; k < 4; k++) {
      if (k !== p && k !== q) {
        const akp = a[k]![p]!,
          akq = a[k]![q]!;
        a[k]![p] = a[p]![k] = c * akp - s * akq;
        a[k]![q] = a[q]![k] = s * akp + c * akq;
      }
      const vkp = vectors[k]![p]!,
        vkq = vectors[k]![q]!;
      vectors[k]![p] = c * vkp - s * vkq;
      vectors[k]![q] = s * vkp + c * vkq;
    }
  }
  let best = 0;
  for (let i = 1; i < 4; i++) if (a[i]![i]! > a[best]![best]!) best = i;
  // Horn's matrix is indexed [w, x, y, z]; the runtime stores [x, y, z, w].
  const w = vectors[0]![best]!,
    x = vectors[1]![best]!;
  const y = vectors[2]![best]!,
    z = vectors[3]![best]!;
  const length = Math.hypot(w, x, y, z);
  if (!Number.isFinite(length) || length < 1e-12)
    throw new Error('The landmark rotation is degenerate.');
  return [x / length, y / length, z / length, w / length];
}

/** Weighted rigid+uniform-scale initialization; no arbitrary mesh indices are assumed. */
export function fitLandmarkSimilarity(
  pairs: readonly LandmarkPair[],
): SimilarityFit {
  if (pairs.length < 4)
    throw new Error('At least four 3D landmark pairs are required.');
  let totalWeight = 0;
  const templateMean = [0, 0, 0];
  const sourceMean = [0, 0, 0];
  for (const pair of pairs) {
    const weight = pair.weight ?? 1;
    if (
      !Number.isFinite(weight) ||
      weight <= 0 ||
      [...pair.template, ...pair.source].some(
        (value) => !Number.isFinite(value),
      )
    )
      throw new Error(
        'Landmark pairs must contain finite coordinates and positive weights.',
      );
    totalWeight += weight;
    for (let k = 0; k < 3; k++) {
      templateMean[k] = templateMean[k]! + weight * pair.template[k]!;
      sourceMean[k] = sourceMean[k]! + weight * pair.source[k]!;
    }
  }
  for (let k = 0; k < 3; k++) {
    templateMean[k] = templateMean[k]! / totalWeight;
    sourceMean[k] = sourceMean[k]! / totalWeight;
  }
  const covariance = Array.from({ length: 3 }, () => [0, 0, 0]);
  let denominator = 0;
  for (const pair of pairs) {
    const weight = pair.weight ?? 1;
    const p = pair.template.map((value, k) => value - templateMean[k]!);
    const q = pair.source.map((value, k) => value - sourceMean[k]!);
    denominator += weight * (p[0]! ** 2 + p[1]! ** 2 + p[2]! ** 2);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        covariance[i]![j] = covariance[i]![j]! + weight * p[i]! * q[j]!;
  }
  if (denominator < 1e-12)
    throw new Error('Template landmarks do not span a usable shape.');
  const s = covariance;
  const xx = s[0]![0]!,
    xy = s[0]![1]!,
    xz = s[0]![2]!;
  const yx = s[1]![0]!,
    yy = s[1]![1]!,
    yz = s[1]![2]!;
  const zx = s[2]![0]!,
    zy = s[2]![1]!,
    zz = s[2]![2]!;
  const rotation = largestQuaternion([
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ]);
  let numerator = 0;
  for (const pair of pairs) {
    const p: Point3 = [
      pair.template[0] - templateMean[0]!,
      pair.template[1] - templateMean[1]!,
      pair.template[2] - templateMean[2]!,
    ];
    const q: Point3 = [
      pair.source[0] - sourceMean[0]!,
      pair.source[1] - sourceMean[1]!,
      pair.source[2] - sourceMean[2]!,
    ];
    const rotated = transformPoint(
      { scale: 1, rotation, translation: [0, 0, 0] },
      p,
    );
    numerator +=
      (pair.weight ?? 1) *
      (q[0] * rotated[0] + q[1] * rotated[1] + q[2] * rotated[2]);
  }
  const scale = numerator / denominator;
  if (!Number.isFinite(scale) || scale <= 0)
    throw new Error('Landmarks imply an invalid or reflected scale.');
  const rotatedMean = transformPoint(
    { scale, rotation, translation: [0, 0, 0] },
    templateMean as unknown as Point3,
  );
  const translation: Point3 = [
    sourceMean[0]! - rotatedMean[0],
    sourceMean[1]! - rotatedMean[1],
    sourceMean[2]! - rotatedMean[2],
  ];
  let weightedError = 0,
    maxError = 0;
  for (const pair of pairs) {
    const transformed = transformPoint(
      { scale, rotation, translation },
      pair.template,
    );
    const distance = Math.hypot(
      transformed[0] - pair.source[0],
      transformed[1] - pair.source[1],
      transformed[2] - pair.source[2],
    );
    weightedError += (pair.weight ?? 1) * distance * distance;
    maxError = Math.max(maxError, distance);
  }
  return {
    scale,
    rotation,
    translation,
    rmsError: Math.sqrt(weightedError / totalWeight),
    maxError,
    landmarkCount: pairs.length,
  };
}
