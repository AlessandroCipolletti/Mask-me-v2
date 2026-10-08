import { describe, expect, it } from 'vitest';
import { createNeutralControlState } from './AvatarControlState';
import {
  FACIAL_MORPH_CONTROLS,
  parsePreparedAvatarManifest,
  readFacialControl,
  type PreparedAvatarManifest,
} from './PreparedAvatarManifest';

const bindings = Object.fromEntries(
  FACIAL_MORPH_CONTROLS.map((control) => [control, `morph_${control}`]),
) as unknown as PreparedAvatarManifest['morphs'];

function candidate(): PreparedAvatarManifest {
  return {
    version: 1,
    kind: 'prepared-personalized-avatar',
    sourceSha256: 'a'.repeat(64),
    preparedSha256: 'b'.repeat(64),
    templateId: 'ict-facekit-light/full-face',
    forwardAxis: '+Z',
    upAxis: '+Y',
    units: 'avatar',
    nodes: {
      headRoot: 'HeadRoot',
      face: 'Face',
      identityShell: 'IdentityShell',
      leftEyePivot: 'LeftEyePivot',
      rightEyePivot: 'RightEyePivot',
      jawPivot: 'JawPivot',
      mouthInterior: 'MouthInterior',
      upperTeeth: 'UpperTeeth',
      lowerTeeth: 'LowerTeeth',
      tongue: 'Tongue',
    },
    morphs: bindings,
    jawOpenRadians: 0.4,
    diagnostics: {
      sourceTriangles: 457430,
      shellTriangles: 400000,
      faceTriangles: 9230,
      faceFitErrorAvatarUnits: 0.02,
      seamGapAvatarUnits: 0.001,
      orientationConfidence: 0.99,
      sourceTexturePixels: 4096 ** 2,
      preparedTexturePixels: 2048 ** 2,
    },
  };
}

describe('prepared avatar manifest', () => {
  it('accepts a complete semantic binding set', () => {
    expect(parsePreparedAvatarManifest(candidate()).morphs['jaw.open']).toBe(
      'morph_jaw.open',
    );
  });

  it('rejects incomplete anatomy and duplicate morph mappings', () => {
    const missing = candidate();
    expect(() =>
      parsePreparedAvatarManifest({
        ...missing,
        nodes: { ...missing.nodes, tongue: '' },
      }),
    ).toThrow('anatomy');
    expect(() =>
      parsePreparedAvatarManifest({
        ...missing,
        morphs: {
          ...missing.morphs,
          'jaw.open': missing.morphs['mouth.close'],
        },
      }),
    ).toThrow('distinct');
  });

  it('rejects invalid bounds diagnostics and asset fingerprints', () => {
    const valid = candidate();
    expect(() =>
      parsePreparedAvatarManifest({ ...valid, preparedSha256: 'wrong' }),
    ).toThrow('coordinate frame');
    expect(() =>
      parsePreparedAvatarManifest({
        ...valid,
        diagnostics: { ...valid.diagnostics, orientationConfidence: 2 },
      }),
    ).toThrow('diagnostics');
  });

  it('reads semantic control values with bounded finite output', () => {
    const state = createNeutralControlState();
    state.eyes.left.blink = 2;
    state.eyes.right.blink = Number.NaN;
    state.jaw.open = 0.45;
    expect(readFacialControl(state, 'eyes.left.blink')).toBe(1);
    expect(readFacialControl(state, 'eyes.right.blink')).toBe(0);
    expect(readFacialControl(state, 'jaw.open')).toBe(0.45);
  });
});
