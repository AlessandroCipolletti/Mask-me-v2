import { describe, expect, it } from 'vitest';
import {
  copyControlState,
  createNeutralControlState,
} from './AvatarControlState';
import {
  referencePoses,
  SyntheticControlSource,
} from './SyntheticControlSource';

describe('semantic control state and synthetic source', () => {
  it('copies nested controls without sharing mutable parts', () => {
    const source = createNeutralControlState();
    const target = createNeutralControlState();
    source.head.yaw = 0.4;
    source.eyes.left.blink = 1;
    source.mouth.smileRight = 0.7;
    copyControlState(target, source);
    expect(target).toEqual(source);
    source.eyes.left.blink = 0;
    expect(target.eyes.left.blink).toBe(1);
  });

  it('includes the complete reference pose suite and advances deterministically', () => {
    const ids = new Set(referencePoses.map((pose) => pose.id));
    for (const id of [
      'neutral',
      'yaw-left',
      'yaw-right',
      'pitch-down',
      'pitch-up',
      'roll-left',
      'roll-right',
      'blink-left',
      'blink-right',
      'blink-both',
      'gaze-left',
      'gaze-right',
      'gaze-up',
      'gaze-down',
      'jaw-25',
      'jaw-50',
      'jaw-100',
      'smile',
      'frown',
      'pucker',
      'funnel',
      'brow-left',
      'brow-right',
      'brows-both',
      'smile-jaw',
      'yaw-blink-smile',
    ])
      expect(ids.has(id)).toBe(true);

    const source = new SyntheticControlSource();
    source.startSequence(100);
    expect(source.poseIndex).toBe(0);
    source.update(1600);
    expect(source.poseIndex).toBe(1);
    expect(source.state.head.yaw).toBeCloseTo(-Math.PI / 4);
    source.selectPose(9);
    expect(source.mode).toBe('manual');
    expect(source.state.eyes.left.blink).toBe(1);
    expect(source.state.eyes.right.blink).toBe(1);
    source.edit((state) => {
      state.jaw.open = 0.4;
    });
    expect(source.state.jaw.open).toBe(0.4);
    expect(source.poseIndex).toBeNull();
  });

  it('drives a repeatable continuous sweep without a webcam', () => {
    const source = new SyntheticControlSource();
    source.startSweep(0);
    source.update(1000);
    const yaw = source.state.head.yaw;
    expect(yaw).not.toBe(0);
    expect(source.state.jaw.open).toBeGreaterThan(0);
    source.update(1000);
    expect(source.state.head.yaw).toBe(yaw);
    source.stop();
    source.update(2000);
    expect(source.state.head.yaw).toBe(yaw);
  });
});
