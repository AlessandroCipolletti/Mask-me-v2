import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Uint32BufferAttribute,
} from 'three';
import type { FaceKitTemplate } from './FaceKitTemplate';
import type { LandmarkWarp } from './LandmarkWarp';
import {
  transformPoint,
  type Point3,
  type SimilarityFit,
} from './SimilarityFit';

/** Wireframe diagnostic of rigid registration; this is never exported as an avatar. */
export function createFaceFitOverlay(
  template: FaceKitTemplate,
  fit: SimilarityFit,
  warp?: LandmarkWarp,
): Mesh {
  const transformed = new Float32Array(template.positions.length);
  for (let index = 0; index < template.positions.length; index += 3) {
    const point: Point3 = [
      template.positions[index]!,
      template.positions[index + 1]!,
      template.positions[index + 2]!,
    ];
    const result = warp ? warp.transform(point) : transformPoint(fit, point);
    transformed[index] = result[0];
    transformed[index + 1] = result[1];
    transformed[index + 2] = result[2];
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(transformed, 3));
  geometry.setIndex(new Uint32BufferAttribute(template.groups['M_Face']!, 1));
  const material = new MeshBasicMaterial({
    color: 0x126d91,
    wireframe: true,
    transparent: true,
    opacity: 0.14,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  mesh.name = 'RigidFaceFitDiagnostic';
  mesh.renderOrder = 20;
  return mesh;
}
