import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Texture,
} from 'three';
import { PreviewMaterialFinish } from './PreviewMaterialFinish';

describe('PreviewMaterialFinish', () => {
  it('makes PBR materials less reflective without altering color texture and restores their exact settings', () => {
    const colorMap = new Texture();
    const roughnessMap = new Texture();
    const standard = new MeshStandardMaterial({
      map: colorMap,
      roughness: 0.55,
      roughnessMap,
      metalness: 0.3,
      envMapIntensity: 1.5,
    });
    const physical = new MeshPhysicalMaterial({
      roughness: 0.4,
      clearcoat: 0.8,
      specularIntensity: 0.9,
      sheen: 0.4,
    });
    const root = new Group();
    root.add(new Mesh(new BoxGeometry(), [standard, physical]));
    const finish = new PreviewMaterialFinish(root);
    finish.setMatte(true);
    expect(standard.roughness).toBe(0.82);
    expect(standard.roughnessMap).toBeNull();
    expect(standard.metalness).toBe(0);
    expect(standard.envMapIntensity).toBe(0);
    expect(standard.map).toBe(colorMap);
    expect(physical.clearcoat).toBe(0);
    expect(physical.specularIntensity).toBe(0.2);
    expect(physical.sheen).toBe(0);
    finish.setMatte(false);
    expect(standard.roughness).toBe(0.55);
    expect(standard.roughnessMap).toBe(roughnessMap);
    expect(standard.metalness).toBe(0.3);
    expect(standard.envMapIntensity).toBe(1.5);
    expect(physical.clearcoat).toBe(0.8);
    expect(physical.specularIntensity).toBe(0.9);
    expect(physical.sheen).toBe(0.4);
  });
});
