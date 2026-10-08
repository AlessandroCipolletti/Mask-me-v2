import templateUrl from './assets/facekit-light-v1.bin?url';
import {
  FACIAL_MORPH_CONTROLS,
  type FacialMorphControl,
} from '../avatar/PreparedAvatarManifest';

const EXPECTED_SHA256 =
  '50acc0d54bc140f8ffd9e2d38646b78a1825543456b039bd42d2e127cdeafa2d';
const EXPECTED_COMMIT = 'da5f95a607f5e6b37755b38d3385d7f2853732e5';

interface TemplateHeader {
  readonly version: 1;
  readonly source: string;
  readonly sourceCommit: string;
  readonly license: 'MIT';
  readonly vertexCount: number;
  readonly groups: readonly {
    readonly name: string;
    readonly triangleCount: number;
  }[];
  readonly faceVertexCount: number;
  readonly morphNames: readonly FacialMorphControl[];
  readonly landmarkIds: readonly number[];
}

export interface FaceKitTemplate {
  readonly sourceCommit: string;
  readonly positions: Float32Array;
  readonly groups: Readonly<Record<string, Uint32Array>>;
  readonly faceVertexIds: Uint32Array;
  readonly morphDeltas: Readonly<Record<FacialMorphControl, Float32Array>>;
  readonly landmarkIds: readonly number[];
}

/** Parses the pinned MIT Light template without adding OBJ parsing to the browser. */
export function parseFaceKitTemplate(buffer: ArrayBuffer): FaceKitTemplate {
  if (buffer.byteLength < 100 || buffer.byteLength > 20_000_000)
    throw new Error('Facial template size is invalid.');
  const data = new DataView(buffer);
  if (String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== 'FCT1')
    throw new Error('Facial template header is invalid.');
  const headerLength = data.getUint32(4, true);
  if (
    headerLength < 20 ||
    headerLength > 100_000 ||
    8 + headerLength > buffer.byteLength
  )
    throw new Error('Facial template metadata is invalid.');
  const header: TemplateHeader = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 8, headerLength)),
  );
  if (
    header.version !== 1 ||
    header.sourceCommit !== EXPECTED_COMMIT ||
    header.license !== 'MIT' ||
    !Number.isInteger(header.vertexCount) ||
    header.vertexCount !== 26719 ||
    !Number.isInteger(header.faceVertexCount) ||
    header.faceVertexCount !== 9409 ||
    !Array.isArray(header.groups) ||
    header.groups.length < 8 ||
    !Array.isArray(header.landmarkIds) ||
    header.landmarkIds.length !== 68 ||
    JSON.stringify(header.morphNames) !== JSON.stringify(FACIAL_MORPH_CONTROLS)
  )
    throw new Error('Facial template version or topology is unsupported.');
  let offset = 8 + headerLength + ((4 - (headerLength % 4)) % 4);
  function view<T extends Float32Array | Uint32Array>(
    kind: 'float' | 'uint',
    count: number,
  ): T {
    if (
      !Number.isSafeInteger(count) ||
      count < 0 ||
      offset + count * 4 > buffer.byteLength
    )
      throw new Error('Facial template data is truncated.');
    const result =
      kind === 'float'
        ? new Float32Array(buffer, offset, count)
        : new Uint32Array(buffer, offset, count);
    offset += count * 4;
    return result as T;
  }
  const positions = view<Float32Array>('float', header.vertexCount * 3);
  if (positions.some((value) => !Number.isFinite(value)))
    throw new Error('Facial template positions are invalid.');
  const groups: Record<string, Uint32Array> = {};
  for (const group of header.groups) {
    if (
      typeof group.name !== 'string' ||
      !/^M_[A-Za-z]+$/.test(group.name) ||
      !Number.isInteger(group.triangleCount) ||
      group.triangleCount < 1 ||
      groups[group.name]
    )
      throw new Error('Facial template material groups are invalid.');
    const indices = view<Uint32Array>('uint', group.triangleCount * 3);
    if (indices.some((id) => id >= header.vertexCount))
      throw new Error('Facial template indices are out of range.');
    groups[group.name] = indices;
  }
  const faceVertexIds = view<Uint32Array>('uint', header.faceVertexCount);
  if (
    faceVertexIds.some((id) => id >= header.vertexCount) ||
    new Set(faceVertexIds).size !== faceVertexIds.length
  )
    throw new Error('Facial template face vertex map is invalid.');
  const morphDeltas = {} as Record<FacialMorphControl, Float32Array>;
  for (const name of header.morphNames) {
    const delta = view<Float32Array>('float', header.faceVertexCount * 3);
    if (delta.some((value) => !Number.isFinite(value)))
      throw new Error(`Facial template morph ${name} contains invalid values.`);
    morphDeltas[name] = delta;
  }
  if (
    offset !== buffer.byteLength ||
    header.landmarkIds.some(
      (id) => !Number.isInteger(id) || id < 0 || id >= header.vertexCount,
    )
  )
    throw new Error('Facial template has trailing or invalid landmark data.');
  return {
    sourceCommit: header.sourceCommit,
    positions,
    groups,
    faceVertexIds,
    morphDeltas,
    landmarkIds: header.landmarkIds,
  };
}

let inFlight: Promise<FaceKitTemplate> | null = null;
export function loadFaceKitTemplate(): Promise<FaceKitTemplate> {
  if (!inFlight)
    inFlight = (async () => {
      const response = await fetch(templateUrl, { cache: 'force-cache' });
      if (!response.ok)
        throw new Error('Facial template asset could not be loaded.');
      const buffer = await response.arrayBuffer();
      const hash = new Uint8Array(
        await crypto.subtle.digest('SHA-256', buffer),
      );
      const actual = Array.from(hash, (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      if (actual !== EXPECTED_SHA256)
        throw new Error('Facial template fingerprint mismatch.');
      return parseFaceKitTemplate(buffer);
    })().catch((error) => {
      inFlight = null;
      throw error;
    });
  return inFlight;
}
