import {
  copyControlState,
  createNeutralControlState,
  type AvatarControlState,
} from './AvatarControlState';

export interface ReferencePose {
  readonly id: string;
  readonly label: string;
  readonly state: AvatarControlState;
}

const degrees = (value: number): number => (value * Math.PI) / 180;

function pose(
  id: string,
  label: string,
  edit: (state: AvatarControlState) => void,
): ReferencePose {
  const state = createNeutralControlState();
  edit(state);
  return { id, label, state };
}

/** Deterministic control poses from GOLDEN_AVATAR_SUITE.md, shared by fixture and future rigs. */
export const referencePoses: readonly ReferencePose[] = [
  pose('neutral', 'Neutral', () => undefined),
  pose('yaw-left', 'Yaw −45°', (s) => {
    s.head.yaw = degrees(-45);
  }),
  pose('yaw-right', 'Yaw +45°', (s) => {
    s.head.yaw = degrees(45);
  }),
  pose('pitch-down', 'Pitch −25°', (s) => {
    s.head.pitch = degrees(-25);
  }),
  pose('pitch-up', 'Pitch +25°', (s) => {
    s.head.pitch = degrees(25);
  }),
  pose('roll-left', 'Roll −25°', (s) => {
    s.head.roll = degrees(-25);
  }),
  pose('roll-right', 'Roll +25°', (s) => {
    s.head.roll = degrees(25);
  }),
  pose('blink-left', 'Blink left', (s) => {
    s.eyes.left.blink = 1;
  }),
  pose('blink-right', 'Blink right', (s) => {
    s.eyes.right.blink = 1;
  }),
  pose('blink-both', 'Blink both', (s) => {
    s.eyes.left.blink = s.eyes.right.blink = 1;
  }),
  pose('gaze-left', 'Gaze left', (s) => {
    s.eyes.left.yaw = s.eyes.right.yaw = degrees(-25);
  }),
  pose('gaze-right', 'Gaze right', (s) => {
    s.eyes.left.yaw = s.eyes.right.yaw = degrees(25);
  }),
  pose('gaze-up', 'Gaze up', (s) => {
    s.eyes.left.pitch = s.eyes.right.pitch = degrees(18);
  }),
  pose('gaze-down', 'Gaze down', (s) => {
    s.eyes.left.pitch = s.eyes.right.pitch = degrees(-18);
  }),
  pose('jaw-25', 'Jaw 25%', (s) => {
    s.jaw.open = 0.25;
  }),
  pose('jaw-50', 'Jaw 50%', (s) => {
    s.jaw.open = 0.5;
  }),
  pose('jaw-100', 'Jaw 100%', (s) => {
    s.jaw.open = 1;
  }),
  pose('smile', 'Smile', (s) => {
    s.mouth.smileLeft = s.mouth.smileRight = 1;
  }),
  pose('frown', 'Frown', (s) => {
    s.mouth.frownLeft = s.mouth.frownRight = 1;
  }),
  pose('pucker', 'Pucker', (s) => {
    s.mouth.pucker = 1;
  }),
  pose('funnel', 'Funnel', (s) => {
    s.mouth.funnel = 1;
  }),
  pose('brow-left', 'Brow left', (s) => {
    s.brows.leftUp = 1;
  }),
  pose('brow-right', 'Brow right', (s) => {
    s.brows.rightUp = 1;
  }),
  pose('brows-both', 'Brows both', (s) => {
    s.brows.leftUp = s.brows.rightUp = 1;
  }),
  pose('smile-jaw', 'Smile + jaw', (s) => {
    s.mouth.smileLeft = s.mouth.smileRight = 1;
    s.jaw.open = 0.6;
  }),
  pose('yaw-blink-smile', 'Yaw + blink + smile', (s) => {
    s.head.yaw = degrees(45);
    s.eyes.left.blink = 1;
    s.mouth.smileLeft = s.mouth.smileRight = 1;
  }),
];

export type SyntheticMode = 'manual' | 'sequence' | 'sweep';

export class SyntheticControlSource {
  readonly state = createNeutralControlState();
  mode: SyntheticMode = 'manual';
  poseIndex: number | null = 0;
  private startedMs = 0;
  private lastSequenceIndex = -1;

  selectPose(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= referencePoses.length)
      return;
    this.mode = 'manual';
    this.poseIndex = index;
    copyControlState(this.state, referencePoses[index]!.state);
  }

  edit(edit: (state: AvatarControlState) => void): void {
    this.mode = 'manual';
    this.poseIndex = null;
    edit(this.state);
  }

  startSequence(nowMs: number): void {
    this.mode = 'sequence';
    this.startedMs = nowMs;
    this.lastSequenceIndex = -1;
    this.update(nowMs);
  }

  startSweep(nowMs: number): void {
    this.mode = 'sweep';
    this.poseIndex = null;
    this.startedMs = nowMs;
    copyControlState(this.state, referencePoses[0]!.state);
  }

  stop(): void {
    this.mode = 'manual';
  }

  update(nowMs: number): void {
    if (this.mode === 'sequence') {
      const index =
        Math.floor(Math.max(0, nowMs - this.startedMs) / 1500) %
        referencePoses.length;
      if (index !== this.lastSequenceIndex) {
        this.poseIndex = index;
        copyControlState(this.state, referencePoses[index]!.state);
        this.lastSequenceIndex = index;
      }
    } else if (this.mode === 'sweep') {
      const phase = (nowMs - this.startedMs) / 1000;
      this.state.head.yaw = degrees(45) * Math.sin(phase * 0.85);
      this.state.head.pitch = degrees(20) * Math.sin(phase * 0.43);
      this.state.eyes.left.blink = Math.max(0, Math.sin(phase * 3.2)) ** 12;
      this.state.eyes.right.blink =
        Math.max(0, Math.sin(phase * 3.2 + 0.25)) ** 12;
      this.state.jaw.open = 0.5 + 0.5 * Math.sin(phase * 1.5);
      this.state.mouth.smileLeft = this.state.mouth.smileRight =
        0.5 + 0.5 * Math.sin(phase * 0.7);
      this.state.mouth.pucker = Math.max(0, Math.sin(phase * 0.6 - 1));
      this.state.brows.leftUp = this.state.brows.rightUp =
        0.5 + 0.5 * Math.sin(phase * 0.9);
    }
    this.state.timestampMs = nowMs;
  }
}
