import type { CanonicalImage } from './CharacterImageGenerator';

export type ViewQualityReason =
  | 'dimensions_unverified'
  | 'resolution_too_low'
  | 'aspect_ratio_mismatch'
  | 'image_unavailable';

/** Structural checks only. Identity, hair and accessory consistency need human review. */
export function inspectViewImage(
  image: CanonicalImage,
  decoded?: { width: number; height: number },
): readonly ViewQualityReason[] {
  const width = decoded?.width ?? image.width;
  const height = decoded?.height ?? image.height;
  if (!width || !height) return ['dimensions_unverified'];
  const reasons: ViewQualityReason[] = [];
  if (width < 768 || height < 960) reasons.push('resolution_too_low');
  if (Math.abs(width / height - 4 / 5) > 0.12)
    reasons.push('aspect_ratio_mismatch');
  return reasons;
}

export function blocksAcceptance(
  reasons: readonly ViewQualityReason[],
): boolean {
  return reasons.some((reason) => reason !== 'dimensions_unverified');
}
