/** Canonical avatar axes: +X is avatar right, +Y is up, +Z faces the viewer. */
/** Head angles and eye gaze angles are radians. Head translation is in avatar units. */
export interface AvatarControlState {
  timestampMs: number;
  confidence: number;
  head: {
    yaw: number;
    pitch: number;
    roll: number;
    tx: number;
    ty: number;
    tz: number;
  };
  eyes: {
    left: { yaw: number; pitch: number; blink: number };
    right: { yaw: number; pitch: number; blink: number };
  };
  brows: {
    leftUp: number;
    rightUp: number;
    leftDown: number;
    rightDown: number;
    innerUp: number;
  };
  jaw: { open: number };
  mouth: {
    close: number;
    smileLeft: number;
    smileRight: number;
    frownLeft: number;
    frownRight: number;
    funnel: number;
    pucker: number;
    left: number;
    right: number;
    upperUpLeft: number;
    upperUpRight: number;
    lowerDownLeft: number;
    lowerDownRight: number;
  };
  cheeks: { leftSquint: number; rightSquint: number };
}

export function createNeutralControlState(): AvatarControlState {
  return {
    timestampMs: 0,
    confidence: 1,
    head: { yaw: 0, pitch: 0, roll: 0, tx: 0, ty: 0, tz: 0 },
    eyes: {
      left: { yaw: 0, pitch: 0, blink: 0 },
      right: { yaw: 0, pitch: 0, blink: 0 },
    },
    brows: { leftUp: 0, rightUp: 0, leftDown: 0, rightDown: 0, innerUp: 0 },
    jaw: { open: 0 },
    mouth: {
      close: 0,
      smileLeft: 0,
      smileRight: 0,
      frownLeft: 0,
      frownRight: 0,
      funnel: 0,
      pucker: 0,
      left: 0,
      right: 0,
      upperUpLeft: 0,
      upperUpRight: 0,
      lowerDownLeft: 0,
      lowerDownRight: 0,
    },
    cheeks: { leftSquint: 0, rightSquint: 0 },
  };
}

/** Copies values into a stable object so render frames do not allocate state trees. */
export function copyControlState(
  target: AvatarControlState,
  source: AvatarControlState,
): void {
  target.timestampMs = source.timestampMs;
  target.confidence = source.confidence;
  Object.assign(target.head, source.head);
  Object.assign(target.eyes.left, source.eyes.left);
  Object.assign(target.eyes.right, source.eyes.right);
  Object.assign(target.brows, source.brows);
  Object.assign(target.jaw, source.jaw);
  Object.assign(target.mouth, source.mouth);
  Object.assign(target.cheeks, source.cheeks);
}
