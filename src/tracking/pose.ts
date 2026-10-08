import type { RawHeadPose } from './observation';

/** Extracts Y-X-Z Euler angles from MediaPipe's row-major model matrix. No mirror correction. */
export function readRawHeadPose(data: readonly number[]): RawHeadPose | null {
  if (data.length !== 16 || data.some((value) => !Number.isFinite(value)))
    return null;

  const columnLength = (a: number, b: number, c: number) => Math.hypot(a, b, c);
  const sx = columnLength(data[0]!, data[4]!, data[8]!);
  const sy = columnLength(data[1]!, data[5]!, data[9]!);
  const sz = columnLength(data[2]!, data[6]!, data[10]!);
  if (sx < 1e-8 || sy < 1e-8 || sz < 1e-8) return null;

  const r00 = data[0]! / sx;
  const r02 = data[2]! / sz;
  const r10 = data[4]! / sx;
  const r11 = data[5]! / sy;
  const r12 = data[6]! / sz;
  const r20 = data[8]! / sx;
  const r22 = data[10]! / sz;

  const pitch = Math.asin(Math.max(-1, Math.min(1, -r12)));
  const nearGimbalLock = Math.abs(r12) >= 0.9999;
  const yaw = nearGimbalLock ? Math.atan2(-r20, r00) : Math.atan2(r02, r22);
  const roll = nearGimbalLock ? 0 : Math.atan2(r10, r11);

  return {
    yaw,
    pitch,
    roll,
    translation: [data[3]!, data[7]!, data[11]!],
    matrix: [...data],
  };
}
