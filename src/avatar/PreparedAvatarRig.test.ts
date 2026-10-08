import {
  BoxGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { describe, expect, it } from 'vitest';
import { createNeutralControlState } from './AvatarControlState';
import {
  FACIAL_MORPH_CONTROLS,
  type PreparedAvatarManifest,
} from './PreparedAvatarManifest';
import { PreparedAvatarRig } from './PreparedAvatarRig';

class TestFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob: Blob): void {
    void blob.arrayBuffer().then((value) => {
      this.result = `data:application/octet-stream;base64,${btoa(String.fromCharCode(...new Uint8Array(value)))}`;
      this.onloadend?.();
    });
  }
}

async function fixture(): Promise<{
  blob: Blob;
  manifest: PreparedAvatarManifest;
}> {
  const root = new Group();
  const head = new Group();
  head.name = 'HeadRoot';
  root.add(head);
  const material = new MeshStandardMaterial({ color: 0xb8866e });
  const shell = new Mesh(new BoxGeometry(1, 2, 1), material);
  shell.name = 'IdentityShell';
  head.add(shell);
  const faceGeometry = new SphereGeometry(0.4, 8, 6);
  const base = faceGeometry.getAttribute('position');
  faceGeometry.morphAttributes.position = FACIAL_MORPH_CONTROLS.map((key) => {
    const values = new Float32Array(base.count * 3);
    for (let i = 0; i < base.count; i++) {
      values[i * 3] = base.getX(i);
      values[i * 3 + 1] = base.getY(i) + 0.02;
      values[i * 3 + 2] = base.getZ(i);
    }
    const attribute = new Float32BufferAttribute(values, 3);
    attribute.name = key;
    return attribute;
  });
  const face = new Mesh(faceGeometry, material);
  face.name = 'Face';
  face.position.z = 0.4;
  face.updateMorphTargets();
  head.add(face);
  for (const name of [
    'LeftEyePivot',
    'RightEyePivot',
    'JawPivot',
    'MouthInterior',
    'UpperTeeth',
  ]) {
    const group = new Group();
    group.name = name;
    head.add(group);
  }
  const jaw = head.getObjectByName('JawPivot')!;
  for (const name of ['LowerTeeth', 'Tongue']) {
    const group = new Group();
    group.name = name;
    jaw.add(group);
  }

  const previous = globalThis.FileReader;
  Object.defineProperty(globalThis, 'FileReader', {
    configurable: true,
    value: TestFileReader,
  });
  let bytes: ArrayBuffer;
  try {
    bytes = (await new GLTFExporter().parseAsync(root, {
      binary: true,
    })) as ArrayBuffer;
  } finally {
    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      value: previous,
    });
    shell.geometry.dispose();
    face.geometry.dispose();
    material.dispose();
  }
  const blob = new Blob([bytes], { type: 'model/gltf-binary' });
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const manifest: PreparedAvatarManifest = {
    version: 1,
    kind: 'prepared-personalized-avatar',
    sourceSha256: 'a'.repeat(64),
    preparedSha256: Array.from(hash, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join(''),
    templateId: 'test/semantic-rig',
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
    morphs: Object.fromEntries(
      FACIAL_MORPH_CONTROLS.map((key) => [key, key]),
    ) as PreparedAvatarManifest['morphs'],
    jawOpenRadians: 0.4,
    diagnostics: {
      sourceTriangles: 100,
      shellTriangles: 12,
      faceTriangles: 80,
      faceFitErrorAvatarUnits: 0,
      seamGapAvatarUnits: 0,
      orientationConfidence: 1,
      sourceTexturePixels: 1,
      preparedTexturePixels: 1,
    },
  };
  return { blob, manifest };
}

describe('prepared avatar runtime', () => {
  it('loads a semantic GLB and drives independent face, eye and jaw controls', async () => {
    const { blob, manifest } = await fixture();
    const rig = await PreparedAvatarRig.load(blob, manifest);
    const state = createNeutralControlState();
    state.head.yaw = Math.PI / 4;
    state.eyes.left.blink = 1;
    state.eyes.right.blink = 0;
    state.eyes.left.yaw = 0.2;
    state.jaw.open = 0.5;
    rig.apply(state);
    const head = rig.root.getObjectByName('HeadRoot')!;
    const face = rig.root.getObjectByName('Face') as Mesh;
    expect(head.rotation.y).toBeCloseTo(Math.PI / 4);
    expect(
      face.morphTargetInfluences?.[
        face.morphTargetDictionary!['eyes.left.blink']!
      ],
    ).toBe(1);
    expect(
      face.morphTargetInfluences?.[
        face.morphTargetDictionary!['eyes.right.blink']!
      ],
    ).toBe(0);
    expect(rig.root.getObjectByName('LeftEyePivot')?.rotation.y).toBeCloseTo(
      0.2,
    );
    expect(rig.root.getObjectByName('JawPivot')?.rotation.x).toBeCloseTo(0.2);
    rig.dispose();
  });

  it('rejects a GLB with a mismatched manifest fingerprint', async () => {
    const { blob, manifest } = await fixture();
    await expect(
      PreparedAvatarRig.load(blob, {
        ...manifest,
        preparedSha256: '0'.repeat(64),
      }),
    ).rejects.toThrow('fingerprint');
  });
});
