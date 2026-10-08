import {
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
  type Texture,
} from 'three';

interface FinishSnapshot {
  readonly material: MeshStandardMaterial;
  readonly roughness: number;
  readonly roughnessMap: Texture | null;
  readonly metalness: number;
  readonly metalnessMap: Texture | null;
  readonly envMapIntensity: number;
  readonly physical: {
    readonly clearcoat: number;
    readonly specularIntensity: number;
    readonly sheen: number;
  } | null;
}

/** Reversible rendering experiment; never changes the downloaded GLB bytes. */
export class PreviewMaterialFinish {
  private readonly originals: FinishSnapshot[] = [];

  constructor(root: Object3D) {
    const seen = new Set<MeshStandardMaterial>();
    root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material]) {
        if (!(material instanceof MeshStandardMaterial) || seen.has(material))
          continue;
        seen.add(material);
        this.originals.push({
          material,
          roughness: material.roughness,
          roughnessMap: material.roughnessMap,
          metalness: material.metalness,
          metalnessMap: material.metalnessMap,
          envMapIntensity: material.envMapIntensity,
          physical:
            material instanceof MeshPhysicalMaterial
              ? {
                  clearcoat: material.clearcoat,
                  specularIntensity: material.specularIntensity,
                  sheen: material.sheen,
                }
              : null,
        });
      }
    });
  }

  setMatte(enabled: boolean): void {
    for (const original of this.originals) {
      const material = original.material;
      material.roughness = enabled
        ? Math.max(0.82, original.roughness)
        : original.roughness;
      material.roughnessMap = enabled ? null : original.roughnessMap;
      material.metalness = enabled ? 0 : original.metalness;
      material.metalnessMap = enabled ? null : original.metalnessMap;
      material.envMapIntensity = enabled ? 0 : original.envMapIntensity;
      if (original.physical && material instanceof MeshPhysicalMaterial) {
        material.clearcoat = enabled ? 0 : original.physical.clearcoat;
        material.specularIntensity = enabled
          ? 0.2
          : original.physical.specularIntensity;
        material.sheen = enabled ? 0 : original.physical.sheen;
      }
      material.needsUpdate = true;
    }
  }
}
