import {
  Box3,
  Group,
  Mesh,
  Object3D,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AvatarControlState } from './AvatarControlState';
import type { AvatarRigAdapter } from './AvatarRigAdapter';
import {
  FACIAL_MORPH_CONTROLS,
  parsePreparedAvatarManifest,
  readFacialControl,
  type PreparedAvatarManifest,
} from './PreparedAvatarManifest';
import { validateGlbContainer } from '../reconstruction/GlbContainer';

function disposeScene(scene: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material)
      ? node.material
      : [node.material]) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (
          value &&
          typeof value === 'object' &&
          'isTexture' in value &&
          value.isTexture
        )
          textures.add(value as Texture);
      }
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) {
    const image = texture.image as { close?: () => void } | undefined;
    texture.dispose();
    image?.close?.();
  }
  for (const material of materials) material.dispose();
}

const unit = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const bounded = (value: number, limit: number): number =>
  Number.isFinite(value) ? Math.min(limit, Math.max(-limit, value)) : 0;

async function digest(bytes: ArrayBuffer): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

function findUnique(root: Object3D, name: string): Object3D {
  let match: Object3D | null = null;
  root.traverse((node) => {
    if (node.name !== name) return;
    if (match) throw new Error(`Prepared avatar has duplicate node ${name}.`);
    match = node;
  });
  if (!match) throw new Error(`Prepared avatar is missing node ${name}.`);
  return match;
}

function isInside(node: Object3D, ancestor: Object3D): boolean {
  for (let current: Object3D | null = node; current; current = current.parent)
    if (current === ancestor) return true;
  return false;
}

/** Runtime contract for a prepared asset. This never sees MediaPipe or source topology. */
export class PreparedAvatarRig implements AvatarRigAdapter {
  readonly root = new Group();
  readonly manifest: {
    readonly kind: string;
    readonly forwardAxis: '+Z';
    readonly upAxis: '+Y';
    readonly units: string;
    readonly nodes: readonly string[];
    readonly morphNames: readonly string[];
  };
  readonly preparation: PreparedAvatarManifest;
  private readonly headRoot: Object3D;
  private readonly leftEye: Object3D;
  private readonly rightEye: Object3D;
  private readonly jaw: Object3D;
  private readonly face: Mesh;
  private readonly morphIndices: Uint16Array;
  private disposed = false;

  private constructor(scene: Group, manifest: PreparedAvatarManifest) {
    this.preparation = manifest;
    this.root.name = 'PreparedAvatarRoot';
    this.root.add(scene);
    const n = manifest.nodes;
    this.headRoot = findUnique(scene, n.headRoot);
    const face = findUnique(scene, n.face);
    if (!(face instanceof Mesh))
      throw new Error('Prepared face is not a mesh.');
    this.face = face;
    this.leftEye = findUnique(scene, n.leftEyePivot);
    this.rightEye = findUnique(scene, n.rightEyePivot);
    this.jaw = findUnique(scene, n.jawPivot);
    const shell = findUnique(scene, n.identityShell);
    for (const name of Object.values(n)) {
      if (!isInside(findUnique(scene, name), this.headRoot))
        throw new Error(
          `Prepared anatomy node ${name} is outside the head root.`,
        );
    }
    if (
      !isInside(findUnique(scene, n.lowerTeeth), this.jaw) ||
      !isInside(findUnique(scene, n.tongue), this.jaw)
    )
      throw new Error('Lower teeth and tongue must follow the jaw.');
    if (!this.face.morphTargetDictionary || !this.face.morphTargetInfluences)
      throw new Error('Prepared face has no morph targets.');
    if (
      this.headRoot.position.length() > 0.0001 ||
      this.headRoot.rotation.x !== 0 ||
      this.headRoot.rotation.y !== 0 ||
      this.headRoot.rotation.z !== 0 ||
      this.headRoot.scale.distanceTo(new Vector3(1, 1, 1)) > 0.0001
    )
      throw new Error(
        'Prepared head root must be centered with an identity transform.',
      );
    let shellMeshes = 0;
    shell.traverse((node) => {
      if (node instanceof Mesh) shellMeshes++;
    });
    if (!shellMeshes)
      throw new Error('Prepared identity shell contains no mesh.');
    this.morphIndices = new Uint16Array(FACIAL_MORPH_CONTROLS.length);
    for (let i = 0; i < FACIAL_MORPH_CONTROLS.length; i++) {
      const name = manifest.morphs[FACIAL_MORPH_CONTROLS[i]!];
      const index = this.face.morphTargetDictionary[name];
      if (
        index === undefined ||
        index >= this.face.morphTargetInfluences.length
      )
        throw new Error(`Prepared face is missing morph ${name}.`);
      const attribute = this.face.geometry.morphAttributes.position?.[index];
      if (
        !attribute ||
        attribute.count !== this.face.geometry.getAttribute('position').count
      )
        throw new Error(`Prepared morph ${name} has incompatible topology.`);
      this.morphIndices[i] = index;
    }
    if (
      !this.face.geometry.getAttribute('normal') ||
      !this.face.geometry.getAttribute('uv')
    )
      throw new Error('Prepared face needs normals and texture coordinates.');
    const bounds = new Box3()
      .setFromObject(this.headRoot)
      .getSize(new Vector3());
    if (
      bounds.x < 0.5 ||
      bounds.y < 0.5 ||
      bounds.z < 0.3 ||
      Math.max(bounds.x, bounds.y, bounds.z) > 10
    )
      throw new Error('Prepared head has invalid normalized bounds.');
    this.headRoot.rotation.order = 'YXZ';
    this.manifest = {
      kind: manifest.kind,
      forwardAxis: '+Z',
      upAxis: '+Y',
      units: manifest.units,
      nodes: Object.values(n),
      morphNames: FACIAL_MORPH_CONTROLS.map((key) => manifest.morphs[key]),
    };
  }

  static async load(
    blob: Blob,
    rawManifest: unknown,
  ): Promise<PreparedAvatarRig> {
    const manifest = parsePreparedAvatarManifest(rawManifest);
    const bytes = await blob.arrayBuffer();
    validateGlbContainer(bytes);
    if ((await digest(bytes)) !== manifest.preparedSha256)
      throw new Error('Prepared GLB does not match its manifest fingerprint.');
    const gltf = await new GLTFLoader().parseAsync(bytes, '');
    try {
      return new PreparedAvatarRig(gltf.scene, manifest);
    } catch (error) {
      disposeScene(gltf.scene);
      throw error;
    }
  }

  apply(state: Readonly<AvatarControlState>): void {
    if (this.disposed) return;
    const h = state.head;
    this.headRoot.position.set(
      bounded(h.tx, 0.5),
      bounded(h.ty, 0.5),
      bounded(h.tz, 0.5),
    );
    this.headRoot.rotation.set(
      bounded(h.pitch, 0.8),
      bounded(h.yaw, Math.PI),
      bounded(h.roll, 0.8),
      'YXZ',
    );
    this.leftEye.rotation.set(
      bounded(state.eyes.left.pitch, 0.38),
      bounded(state.eyes.left.yaw, 0.5),
      0,
    );
    this.rightEye.rotation.set(
      bounded(state.eyes.right.pitch, 0.38),
      bounded(state.eyes.right.yaw, 0.5),
      0,
    );
    const jaw = unit(state.jaw.open) * (1 - unit(state.mouth.close));
    this.jaw.rotation.x = jaw * this.preparation.jawOpenRadians;
    const influences = this.face.morphTargetInfluences!;
    for (let i = 0; i < FACIAL_MORPH_CONTROLS.length; i++) {
      const control = FACIAL_MORPH_CONTROLS[i]!;
      const value = readFacialControl(state, control);
      influences[this.morphIndices[i]!] = control === 'jaw.open' ? jaw : value;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    disposeScene(this.root);
    this.root.clear();
  }
}
