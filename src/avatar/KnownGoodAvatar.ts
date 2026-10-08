import { Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import {
  createNeutralControlState,
  type AvatarControlState,
} from './AvatarControlState';
import type { AvatarRigAdapter } from './AvatarRigAdapter';

const unit = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const bounded = (value: number, limit: number): number =>
  Number.isFinite(value) ? Math.min(limit, Math.max(-limit, value)) : 0;

/** Procedural, deterministic fixture. Its geometry is intentionally not a generated-avatar topology. */
export class KnownGoodAvatar implements AvatarRigAdapter {
  readonly root = new Group();
  readonly headRoot = new Group();
  readonly manifest = {
    kind: 'm2-procedural-complete-head',
    forwardAxis: '+Z',
    upAxis: '+Y',
    units: 'head height ≈ 2',
    nodes: [] as string[],
    morphNames: [] as readonly string[],
  } as const;

  private readonly geometry = new SphereGeometry(1, 24, 16);
  private readonly materials = {
    skin: new MeshStandardMaterial({ color: 0xc68b68, roughness: 0.87 }),
    hair: new MeshStandardMaterial({ color: 0x33302e, roughness: 0.92 }),
    eye: new MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.34 }),
    iris: new MeshStandardMaterial({ color: 0x4e7d69, roughness: 0.38 }),
    pupil: new MeshStandardMaterial({ color: 0x181b1a, roughness: 0.25 }),
    brow: new MeshStandardMaterial({ color: 0x2b2725, roughness: 0.95 }),
    lip: new MeshStandardMaterial({ color: 0x995b54, roughness: 0.76 }),
    cavity: new MeshStandardMaterial({ color: 0x301d23, roughness: 1 }),
    teeth: new MeshStandardMaterial({ color: 0xf1e5d5, roughness: 0.48 }),
    tongue: new MeshStandardMaterial({ color: 0xb86d70, roughness: 0.85 }),
    shirt: new MeshStandardMaterial({ color: 0x52655d, roughness: 0.95 }),
  };
  private readonly eyePivots: [Group, Group] = [new Group(), new Group()];
  private readonly eyelids: [Mesh, Mesh];
  private readonly brows: [Mesh, Mesh];
  private readonly cheeks: [Mesh, Mesh];
  private readonly jawRoot = new Group();
  private readonly cavity: Mesh;
  private readonly upperLips: [Mesh, Mesh];
  private readonly lowerLip: Mesh;
  private readonly mouthCorners: [Mesh, Mesh];
  private readonly upperTeeth: Mesh;
  private readonly lowerTeeth: Mesh;
  private disposed = false;

  constructor() {
    this.root.name = 'AvatarRoot';
    this.headRoot.name = 'HeadRoot';
    this.headRoot.rotation.order = 'YXZ';
    this.root.add(this.headRoot);
    const skin = this.materials.skin;
    const hair = this.materials.hair;
    this.part(this.headRoot, 'Skull', skin, 0, 0, 0, 0.72, 0.93, 0.65);
    this.part(
      this.headRoot,
      'RearHair',
      hair,
      0,
      0.22,
      -0.36,
      0.75,
      0.81,
      0.38,
    );
    this.part(this.headRoot, 'HairCap', hair, 0, 0.84, -0.04, 0.74, 0.33, 0.63);
    this.part(
      this.headRoot,
      'HairFringeLeft',
      hair,
      -0.39,
      0.69,
      0.43,
      0.31,
      0.18,
      0.27,
    );
    this.part(
      this.headRoot,
      'HairFringeRight',
      hair,
      0.28,
      0.76,
      0.45,
      0.38,
      0.16,
      0.24,
    );
    this.part(
      this.headRoot,
      'LeftEar',
      skin,
      -0.72,
      -0.08,
      0.02,
      0.16,
      0.24,
      0.1,
    );
    this.part(
      this.headRoot,
      'RightEar',
      skin,
      0.72,
      -0.08,
      0.02,
      0.16,
      0.24,
      0.1,
    );
    this.part(this.headRoot, 'Nose', skin, 0, -0.08, 0.66, 0.14, 0.23, 0.19);
    this.part(this.headRoot, 'Neck', skin, 0, -0.93, -0.12, 0.28, 0.38, 0.27);
    this.part(
      this.headRoot,
      'Shoulders',
      this.materials.shirt,
      0,
      -1.24,
      -0.1,
      0.83,
      0.25,
      0.4,
    );

    for (const [index, x] of [-0.31, 0.31].entries()) {
      const name = index === 0 ? 'Left' : 'Right';
      const pivot = this.eyePivots[index]!;
      pivot.name = `${name}EyePivot`;
      pivot.position.set(x, 0.18, 0.58);
      this.headRoot.add(pivot);
      this.part(
        pivot,
        `${name}Eye`,
        this.materials.eye,
        0,
        0,
        0,
        0.19,
        0.16,
        0.14,
      );
      this.part(
        pivot,
        `${name}Iris`,
        this.materials.iris,
        0,
        0,
        0.135,
        0.09,
        0.09,
        0.025,
      );
      this.part(
        pivot,
        `${name}Pupil`,
        this.materials.pupil,
        0,
        0,
        0.158,
        0.045,
        0.05,
        0.013,
      );
    }
    this.eyelids = [
      this.part(
        this.headRoot,
        'LeftEyelid',
        skin,
        -0.31,
        0.35,
        0.735,
        0.2,
        0.005,
        0.035,
      ),
      this.part(
        this.headRoot,
        'RightEyelid',
        skin,
        0.31,
        0.35,
        0.735,
        0.2,
        0.005,
        0.035,
      ),
    ];
    this.brows = [
      this.part(
        this.headRoot,
        'LeftBrow',
        this.materials.brow,
        -0.31,
        0.49,
        0.64,
        0.22,
        0.044,
        0.045,
      ),
      this.part(
        this.headRoot,
        'RightBrow',
        this.materials.brow,
        0.31,
        0.49,
        0.64,
        0.22,
        0.044,
        0.045,
      ),
    ];
    this.cheeks = [
      this.part(
        this.headRoot,
        'LeftCheek',
        skin,
        -0.47,
        -0.22,
        0.55,
        0.19,
        0.12,
        0.08,
      ),
      this.part(
        this.headRoot,
        'RightCheek',
        skin,
        0.47,
        -0.22,
        0.55,
        0.19,
        0.12,
        0.08,
      ),
    ];

    this.cavity = this.part(
      this.headRoot,
      'MouthInterior',
      this.materials.cavity,
      0,
      -0.43,
      0.635,
      0.23,
      0.04,
      0.045,
    );
    this.upperTeeth = this.part(
      this.headRoot,
      'UpperTeeth',
      this.materials.teeth,
      0,
      -0.37,
      0.69,
      0.15,
      0.04,
      0.025,
    );
    this.upperLips = [
      this.part(
        this.headRoot,
        'UpperLipLeft',
        this.materials.lip,
        -0.12,
        -0.35,
        0.69,
        0.15,
        0.047,
        0.055,
      ),
      this.part(
        this.headRoot,
        'UpperLipRight',
        this.materials.lip,
        0.12,
        -0.35,
        0.69,
        0.15,
        0.047,
        0.055,
      ),
    ];
    this.mouthCorners = [
      this.part(
        this.headRoot,
        'MouthCornerLeft',
        this.materials.lip,
        -0.25,
        -0.39,
        0.65,
        0.055,
        0.055,
        0.055,
      ),
      this.part(
        this.headRoot,
        'MouthCornerRight',
        this.materials.lip,
        0.25,
        -0.39,
        0.65,
        0.055,
        0.055,
        0.055,
      ),
    ];
    this.jawRoot.name = 'JawRoot';
    this.jawRoot.position.set(0, -0.22, 0.2);
    this.headRoot.add(this.jawRoot);
    this.part(this.jawRoot, 'Chin', skin, 0, -0.49, 0.12, 0.47, 0.3, 0.37);
    this.lowerLip = this.part(
      this.jawRoot,
      'LowerLip',
      this.materials.lip,
      0,
      -0.23,
      0.49,
      0.23,
      0.055,
      0.06,
    );
    this.lowerTeeth = this.part(
      this.jawRoot,
      'LowerTeeth',
      this.materials.teeth,
      0,
      -0.2,
      0.47,
      0.14,
      0.04,
      0.025,
    );
    this.part(
      this.jawRoot,
      'Tongue',
      this.materials.tongue,
      0,
      -0.28,
      0.45,
      0.14,
      0.035,
      0.045,
    );
    this.apply(createNeutralControlState());
    this.root.traverse((node) => this.manifest.nodes.push(node.name));
  }

  private part(
    parent: Group,
    name: string,
    material: MeshStandardMaterial,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ): Mesh {
    const mesh = new Mesh(this.geometry, material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
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
    for (let index = 0; index < 2; index++) {
      const eye = index === 0 ? state.eyes.left : state.eyes.right;
      this.eyePivots[index]!.rotation.set(
        bounded(eye.pitch, 0.38),
        bounded(eye.yaw, 0.5),
        0,
      );
      const blink = unit(eye.blink);
      this.eyelids[index]!.position.y = 0.35 - 0.17 * blink;
      this.eyelids[index]!.scale.y = 0.005 + 0.17 * blink;
    }
    const b = state.brows;
    this.brows[0].position.y =
      0.49 +
      0.14 * unit(b.leftUp) -
      0.09 * unit(b.leftDown) +
      0.05 * unit(b.innerUp);
    this.brows[1].position.y =
      0.49 +
      0.14 * unit(b.rightUp) -
      0.09 * unit(b.rightDown) +
      0.05 * unit(b.innerUp);
    this.brows[0].rotation.z = -0.16 * unit(b.innerUp);
    this.brows[1].rotation.z = 0.16 * unit(b.innerUp);
    this.cheeks[0].scale.y = 0.12 + 0.05 * unit(state.cheeks.leftSquint);
    this.cheeks[1].scale.y = 0.12 + 0.05 * unit(state.cheeks.rightSquint);

    const m = state.mouth;
    const jaw = unit(state.jaw.open);
    const close = unit(m.close);
    const pucker = unit(m.pucker);
    const funnel = unit(m.funnel);
    const lateral = unit(m.right) - unit(m.left);
    const width = 1 - 0.42 * pucker - 0.25 * funnel;
    const aperture = jaw * (1 - close);
    this.jawRoot.rotation.x = 0.48 * jaw;
    this.cavity.scale.set(
      0.23 * width,
      0.035 + 0.18 * aperture + 0.06 * funnel,
      0.045,
    );
    this.cavity.position.x = 0.1 * lateral;
    this.upperTeeth.visible = aperture > 0.12;
    this.lowerTeeth.visible = aperture > 0.18;
    for (let index = 0; index < 2; index++) {
      const side = index === 0 ? -1 : 1;
      const smile = unit(index === 0 ? m.smileLeft : m.smileRight);
      const frown = unit(index === 0 ? m.frownLeft : m.frownRight);
      const upper = unit(index === 0 ? m.upperUpLeft : m.upperUpRight);
      this.upperLips[index]!.position.set(
        side * 0.12 * width + 0.1 * lateral,
        -0.35 + 0.05 * smile - 0.04 * frown + 0.07 * upper,
        0.69 + 0.08 * pucker,
      );
      this.mouthCorners[index]!.position.set(
        side * (0.25 + 0.05 * smile) * width + 0.1 * lateral,
        -0.39 + 0.12 * smile - 0.1 * frown,
        0.65 + 0.07 * pucker,
      );
    }
    this.lowerLip.position.y =
      -0.23 -
      0.05 * (unit(m.lowerDownLeft) + unit(m.lowerDownRight)) * 0.5 +
      0.06 * close;
    this.lowerLip.position.x = 0.1 * lateral;
    this.lowerLip.scale.x = 0.23 * width;
    this.lowerLip.position.z = 0.49 + 0.08 * pucker;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    this.geometry.dispose();
    for (const material of Object.values(this.materials)) material.dispose();
    this.root.clear();
  }
}
