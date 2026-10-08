export type FlowPhase =
  | 'idle'
  | 'keyReady'
  | 'cameraReady'
  | 'captured'
  | 'stylizing'
  | 'views'
  | 'reconstructing'
  | 'preparing'
  | 'loading'
  | 'calibrating'
  | 'live';

export interface FlowState {
  readonly phase: FlowPhase;
  readonly enteredAtMs: number;
}

const nextPhase: Partial<Record<FlowPhase, FlowPhase>> = {
  idle: 'keyReady',
  keyReady: 'cameraReady',
  cameraReady: 'captured',
  captured: 'stylizing',
  stylizing: 'views',
  views: 'reconstructing',
  reconstructing: 'preparing',
  preparing: 'loading',
  loading: 'calibrating',
  calibrating: 'live',
};

function assertTimestamp(timestampMs: number): void {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) {
    throw new RangeError('Invalid timestamp');
  }
}

export function initialFlow(timestampMs: number): FlowState {
  assertTimestamp(timestampMs);
  return { phase: 'idle', enteredAtMs: timestampMs };
}

/** The M0 flow only defines phase order; stage effects and recovery belong to later milestones. */
export function advanceFlow(
  state: FlowState,
  phase: FlowPhase,
  timestampMs: number,
): FlowState {
  assertTimestamp(timestampMs);
  if (timestampMs < state.enteredAtMs) {
    throw new RangeError('Timestamp precedes current phase');
  }
  if (nextPhase[state.phase] !== phase) {
    throw new Error(`Invalid flow transition from ${state.phase} to ${phase}`);
  }
  return { phase, enteredAtMs: timestampMs };
}

export function resetFlow(timestampMs: number): FlowState {
  return initialFlow(timestampMs);
}
