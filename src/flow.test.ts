import { describe, expect, it } from 'vitest';
import { advanceFlow, initialFlow, resetFlow, type FlowPhase } from './flow';

const orderedPhases: FlowPhase[] = [
  'keyReady',
  'cameraReady',
  'captured',
  'stylizing',
  'views',
  'reconstructing',
  'preparing',
  'loading',
  'calibrating',
  'live',
];

describe('flow state machine', () => {
  it('permits the defined phase order and records entry time', () => {
    let state = initialFlow(100);
    for (const [index, phase] of orderedPhases.entries()) {
      state = advanceFlow(state, phase, 101 + index);
      expect(state).toEqual({ phase, enteredAtMs: 101 + index });
    }
  });

  it('rejects skipped, repeated, and backwards transitions', () => {
    const idle = initialFlow(100);
    expect(() => advanceFlow(idle, 'cameraReady', 101)).toThrow(
      'Invalid flow transition',
    );
    expect(() => advanceFlow(idle, 'idle', 101)).toThrow(
      'Invalid flow transition',
    );
    const keyReady = advanceFlow(idle, 'keyReady', 101);
    expect(() => advanceFlow(keyReady, 'idle', 102)).toThrow(
      'Invalid flow transition',
    );
  });

  it('rejects invalid or regressing timestamps and allows explicit reset', () => {
    expect(() => initialFlow(Number.NaN)).toThrow(RangeError);
    const state = advanceFlow(initialFlow(100), 'keyReady', 101);
    expect(() => advanceFlow(state, 'cameraReady', 100)).toThrow(RangeError);
    expect(resetFlow(200)).toEqual({ phase: 'idle', enteredAtMs: 200 });
  });
});
