import type { AvatarControlState } from './AvatarControlState';

export const PREPARED_AVATAR_VERSION = 1;

/** Paths are semantic controls, never model or tracking landmark indices. */
export const FACIAL_MORPH_CONTROLS = [
  'eyes.left.blink',
  'eyes.right.blink',
  'brows.leftUp',
  'brows.rightUp',
  'brows.leftDown',
  'brows.rightDown',
  'brows.innerUp',
  'jaw.open',
  'mouth.close',
  'mouth.smileLeft',
  'mouth.smileRight',
  'mouth.frownLeft',
  'mouth.frownRight',
  'mouth.funnel',
  'mouth.pucker',
  'mouth.left',
  'mouth.right',
  'mouth.upperUpLeft',
  'mouth.upperUpRight',
  'mouth.lowerDownLeft',
  'mouth.lowerDownRight',
  'cheeks.leftSquint',
  'cheeks.rightSquint',
] as const;

export type FacialMorphControl = (typeof FACIAL_MORPH_CONTROLS)[number];

const controlReaders: Readonly<
  Record<FacialMorphControl, (state: Readonly<AvatarControlState>) => number>
> = {
  'eyes.left.blink': (s) => s.eyes.left.blink,
  'eyes.right.blink': (s) => s.eyes.right.blink,
  'brows.leftUp': (s) => s.brows.leftUp,
  'brows.rightUp': (s) => s.brows.rightUp,
  'brows.leftDown': (s) => s.brows.leftDown,
  'brows.rightDown': (s) => s.brows.rightDown,
  'brows.innerUp': (s) => s.brows.innerUp,
  'jaw.open': (s) => s.jaw.open,
  'mouth.close': (s) => s.mouth.close,
  'mouth.smileLeft': (s) => s.mouth.smileLeft,
  'mouth.smileRight': (s) => s.mouth.smileRight,
  'mouth.frownLeft': (s) => s.mouth.frownLeft,
  'mouth.frownRight': (s) => s.mouth.frownRight,
  'mouth.funnel': (s) => s.mouth.funnel,
  'mouth.pucker': (s) => s.mouth.pucker,
  'mouth.left': (s) => s.mouth.left,
  'mouth.right': (s) => s.mouth.right,
  'mouth.upperUpLeft': (s) => s.mouth.upperUpLeft,
  'mouth.upperUpRight': (s) => s.mouth.upperUpRight,
  'mouth.lowerDownLeft': (s) => s.mouth.lowerDownLeft,
  'mouth.lowerDownRight': (s) => s.mouth.lowerDownRight,
  'cheeks.leftSquint': (s) => s.cheeks.leftSquint,
  'cheeks.rightSquint': (s) => s.cheeks.rightSquint,
};

export interface PreparedAvatarManifest {
  readonly version: 1;
  readonly kind: 'prepared-personalized-avatar';
  readonly sourceSha256: string;
  readonly preparedSha256: string;
  readonly templateId: string;
  readonly forwardAxis: '+Z';
  readonly upAxis: '+Y';
  readonly units: 'avatar';
  readonly nodes: {
    readonly headRoot: string;
    readonly face: string;
    readonly identityShell: string;
    readonly leftEyePivot: string;
    readonly rightEyePivot: string;
    readonly jawPivot: string;
    readonly mouthInterior: string;
    readonly upperTeeth: string;
    readonly lowerTeeth: string;
    readonly tongue: string;
  };
  readonly morphs: Readonly<Record<FacialMorphControl, string>>;
  readonly jawOpenRadians: number;
  readonly diagnostics: {
    readonly sourceTriangles: number;
    readonly shellTriangles: number;
    readonly faceTriangles: number;
    readonly faceFitErrorAvatarUnits: number;
    readonly seamGapAvatarUnits: number;
    readonly orientationConfidence: number;
    readonly sourceTexturePixels: number;
    readonly preparedTexturePixels: number;
  };
}

export function readFacialControl(
  state: Readonly<AvatarControlState>,
  path: FacialMorphControl,
): number {
  const value = controlReaders[path](state);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

const sha256 = /^[a-f0-9]{64}$/;
const name = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 128;

/** Structural validation of untrusted manifest JSON. Visual acceptance is separate. */
export function parsePreparedAvatarManifest(
  value: unknown,
): PreparedAvatarManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Prepared avatar manifest is missing.');
  const m = value as Partial<PreparedAvatarManifest>;
  if (
    m.version !== PREPARED_AVATAR_VERSION ||
    m.kind !== 'prepared-personalized-avatar' ||
    m.forwardAxis !== '+Z' ||
    m.upAxis !== '+Y' ||
    m.units !== 'avatar' ||
    !sha256.test(m.sourceSha256 ?? '') ||
    !sha256.test(m.preparedSha256 ?? '') ||
    !name(m.templateId)
  )
    throw new Error(
      'Prepared avatar manifest has an unsupported identity or coordinate frame.',
    );
  const nodes = m.nodes;
  const morphs = m.morphs;
  if (!nodes || !morphs)
    throw new Error('Prepared avatar rig bindings are missing.');
  const requiredNodes = [
    'headRoot',
    'face',
    'identityShell',
    'leftEyePivot',
    'rightEyePivot',
    'jawPivot',
    'mouthInterior',
    'upperTeeth',
    'lowerTeeth',
    'tongue',
  ] as const;
  if (requiredNodes.some((key) => !name(nodes[key])))
    throw new Error('Prepared avatar has incomplete anatomy bindings.');
  if (
    new Set(requiredNodes.map((key) => nodes[key])).size !==
    requiredNodes.length
  )
    throw new Error('Prepared avatar anatomy nodes must be distinct.');
  if (FACIAL_MORPH_CONTROLS.some((key) => !name(morphs[key])))
    throw new Error('Prepared avatar has incomplete facial morph bindings.');
  if (
    new Set(FACIAL_MORPH_CONTROLS.map((key) => morphs[key])).size !==
    FACIAL_MORPH_CONTROLS.length
  )
    throw new Error('Prepared avatar facial morph bindings must be distinct.');
  const d = m.diagnostics;
  if (
    !d ||
    !Number.isFinite(m.jawOpenRadians) ||
    m.jawOpenRadians! <= 0 ||
    m.jawOpenRadians! > 1 ||
    !Number.isInteger(d.sourceTriangles) ||
    d.sourceTriangles < 1 ||
    !Number.isInteger(d.shellTriangles) ||
    d.shellTriangles < 1 ||
    !Number.isInteger(d.faceTriangles) ||
    d.faceTriangles < 1 ||
    !Number.isFinite(d.faceFitErrorAvatarUnits) ||
    d.faceFitErrorAvatarUnits < 0 ||
    !Number.isFinite(d.seamGapAvatarUnits) ||
    d.seamGapAvatarUnits < 0 ||
    !Number.isFinite(d.orientationConfidence) ||
    d.orientationConfidence < 0 ||
    d.orientationConfidence > 1 ||
    !Number.isInteger(d.sourceTexturePixels) ||
    d.sourceTexturePixels < 1 ||
    !Number.isInteger(d.preparedTexturePixels) ||
    d.preparedTexturePixels < 1
  )
    throw new Error('Prepared avatar diagnostics are invalid.');
  return m as PreparedAvatarManifest;
}
