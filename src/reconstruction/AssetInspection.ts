import { Box3, BufferGeometry, Material, Mesh, Object3D, Vector3 } from 'three';

export { MAX_GLB_BYTES, validateGlbContainer } from './GlbContainer';

export interface AssetInspection {
  readonly bytes: number;
  readonly meshes: number;
  readonly triangles: number;
  readonly materials: number;
  readonly texturedMaterials: number;
  readonly missingNormals: number;
  readonly bounds: readonly [number, number, number];
  readonly scaleToAvatar: number;
  readonly warnings: readonly string[];
}

export function normalizedScale(
  size: readonly [number, number, number],
): number {
  const largest = Math.max(...size);
  if (
    size.some((value) => !Number.isFinite(value) || value <= 0) ||
    largest < 0.000001 ||
    largest > 1_000_000
  )
    throw new Error('The 3D asset has invalid or pathological bounds.');
  return 2.4 / largest;
}

/** Measures geometry after glTF parsing; does not change the original GLB. */
export function inspectScene(root: Object3D, bytes: number): AssetInspection {
  let meshes = 0;
  let triangles = 0;
  let missingNormals = 0;
  const materials = new Set<Material>();
  const texturedMaterials = new Set<Material>();
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    meshes++;
    const geometry = node.geometry as BufferGeometry;
    const position = geometry.getAttribute('position');
    if (!position || position.count < 3) return;
    const count = geometry.index?.count ?? position.count;
    triangles += Math.floor(count / 3);
    if (!geometry.getAttribute('normal')) missingNormals++;
    for (const material of Array.isArray(node.material)
      ? node.material
      : [node.material]) {
      if (!(material instanceof Material)) continue;
      materials.add(material);
      if ('map' in material && material.map) texturedMaterials.add(material);
    }
  });
  if (meshes === 0 || triangles === 0)
    throw new Error('The GLB does not contain usable mesh geometry.');
  const box = new Box3().setFromObject(root);
  if (box.isEmpty())
    throw new Error('The GLB has no measurable geometry bounds.');
  const size = box.getSize(new Vector3());
  const bounds: [number, number, number] = [size.x, size.y, size.z];
  const scaleToAvatar = normalizedScale(bounds);
  const warnings: string[] = [];
  if (missingNormals)
    warnings.push(
      `${missingNormals} mesh(es) have no normals; preview normals will be computed.`,
    );
  if (texturedMaterials.size === 0)
    warnings.push('No color texture was found. Inspect material appearance.');
  if (Math.min(...bounds) / Math.max(...bounds) < 0.08)
    warnings.push(
      'One axis is very thin. Inspect for a frontal shell or flat hair.',
    );
  if (triangles > 2_000_000)
    warnings.push('Very dense geometry may render slowly.');
  return {
    bytes,
    meshes,
    triangles,
    materials: materials.size,
    texturedMaterials: texturedMaterials.size,
    missingNormals,
    bounds,
    scaleToAvatar,
    warnings,
  };
}
