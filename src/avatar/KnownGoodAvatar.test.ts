import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { createNeutralControlState } from './AvatarControlState';
import { KnownGoodAvatar } from './KnownGoodAvatar';

describe('known-good avatar adapter', () => {
  it('rotates the complete head while facial controls remain independent', () => {
    const rig = new KnownGoodAvatar();
    const hair = rig.root.getObjectByName('RearHair');
    const ear = rig.root.getObjectByName('LeftEar');
    const lidLeft = rig.root.getObjectByName('LeftEyelid');
    const lidRight = rig.root.getObjectByName('RightEyelid');
    const leftEye = rig.root.getObjectByName('LeftEyePivot');
    const leftBrow = rig.root.getObjectByName('LeftBrow');
    const leftMouthCorner = rig.root.getObjectByName('MouthCornerLeft');
    const jaw = rig.root.getObjectByName('JawRoot');
    expect(
      hair && ear && lidLeft && lidRight && leftEye && leftBrow && jaw,
    ).toBeTruthy();
    expect(hair!.parent).toBe(rig.headRoot);
    expect(ear!.parent).toBe(rig.headRoot);
    expect(jaw!.parent).toBe(rig.headRoot);
    expect(rig.manifest.nodes).toContain('RearHair');
    expect(rig.manifest.nodes).toContain('JawRoot');

    rig.root.updateMatrixWorld(true);
    const earBefore = ear!.getWorldPosition(new Vector3());
    const state = createNeutralControlState();
    state.head.yaw = Math.PI / 4;
    state.eyes.left.blink = 1;
    state.eyes.left.yaw = 0.25;
    state.brows.leftUp = 1;
    state.jaw.open = 0.8;
    state.mouth.smileLeft = 1;
    rig.apply(state);
    rig.root.updateMatrixWorld(true);
    const earAfter = ear!.getWorldPosition(new Vector3());
    expect(rig.headRoot.rotation.y).toBeCloseTo(Math.PI / 4);
    expect(earAfter.z).not.toBeCloseTo(earBefore.z);
    expect(lidLeft!.scale.y).toBeGreaterThan(lidRight!.scale.y);
    expect(leftEye!.rotation.y).toBeCloseTo(0.25);
    expect(leftBrow!.position.y).toBeGreaterThan(0.49);
    expect(jaw!.rotation.x).toBeGreaterThan(0);
    expect(leftMouthCorner!.position.y).toBeGreaterThan(-0.39);

    state.head.yaw = 0;
    rig.apply(state);
    expect(rig.headRoot.rotation.y).toBe(0);
    expect(lidLeft!.scale.y).toBeGreaterThan(lidRight!.scale.y);
    rig.dispose();
  });

  it('clamps unsafe inputs and releases shared geometry/materials once', () => {
    const rig = new KnownGoodAvatar();
    const skull = rig.root.getObjectByName('Skull')! as import('three').Mesh;
    const disposeGeometry = vi.spyOn(skull.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(
      skull.material as import('three').Material,
      'dispose',
    );
    const state = createNeutralControlState();
    state.head.yaw = Infinity;
    state.eyes.left.blink = 8;
    state.jaw.open = -2;
    rig.apply(state);
    expect(rig.headRoot.rotation.y).toBe(0);
    expect(rig.root.getObjectByName('LeftEyelid')!.scale.y).toBeCloseTo(0.175);
    expect(rig.root.getObjectByName('JawRoot')!.rotation.x).toBe(0);
    rig.dispose();
    rig.dispose();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
    expect(rig.root.children).toHaveLength(0);
  });
});
