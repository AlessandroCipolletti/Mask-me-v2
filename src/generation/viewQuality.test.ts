import { describe, expect, it } from 'vitest';
import { blocksAcceptance, inspectViewImage } from './viewQuality';

const image = { url: 'https://fal.media/view.png', contentType: 'image/png' };

describe('structural view quality gate', () => {
  it('uses decoded dimensions when fal omits them and does not infer identity', () => {
    expect(inspectViewImage(image)).toEqual(['dimensions_unverified']);
    expect(inspectViewImage(image, { width: 1024, height: 1280 })).toEqual([]);
    expect(blocksAcceptance(['dimensions_unverified'])).toBe(false);
  });

  it('flags low resolution and wrong aspect ratio', () => {
    expect(inspectViewImage(image, { width: 512, height: 512 })).toEqual([
      'resolution_too_low',
      'aspect_ratio_mismatch',
    ]);
    expect(blocksAcceptance(['resolution_too_low'])).toBe(true);
  });
});
