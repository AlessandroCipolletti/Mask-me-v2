import { afterEach, describe, expect, it, vi } from 'vitest';
import { FaceTracker, type Detector, type TrackerEvents } from './FaceTracker';
import type { TrackingObservation } from './observation';

const observation: TrackingObservation = {
  timestampMs: 0,
  faceDetected: false,
  confidence: null,
  landmarks: [],
  blendshapes: [],
  pose: null,
};

function fixture() {
  const callbacks: Array<
    (now: number, metadata: { mediaTime: number }) => void
  > = [];
  const video = {
    paused: false,
    readyState: 4,
    currentTime: 0,
    requestVideoFrameCallback: vi.fn((callback) => {
      callbacks.push(callback);
      return callbacks.length;
    }),
    cancelVideoFrameCallback: vi.fn(),
  } as unknown as HTMLVideoElement;
  const detector: Detector = {
    detect: vi.fn(() => observation),
    close: vi.fn(),
  };
  const events: TrackerEvents = {
    onStatus: vi.fn(),
    onObservation: vi.fn(),
    onError: vi.fn(),
  };
  vi.stubGlobal('document', {
    hidden: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('HTMLMediaElement', { HAVE_CURRENT_DATA: 2 });
  return { video, detector, events, callbacks };
}

afterEach(() => vi.unstubAllGlobals());

describe('FaceTracker', () => {
  it('processes each source frame once, pauses, and closes its detector', async () => {
    const { video, detector, events, callbacks } = fixture();
    const tracker = new FaceTracker(async () => detector, events);
    await tracker.start(video);

    callbacks[0]!(100, { mediaTime: 1 });
    callbacks[1]!(116, { mediaTime: 1 });
    callbacks[2]!(132, { mediaTime: 2 });
    expect(detector.detect).toHaveBeenCalledTimes(2);
    expect(events.onObservation).toHaveBeenCalledTimes(2);
    const secondMetrics = vi.mocked(events.onObservation).mock.calls[1]?.[1];
    expect(secondMetrics?.fps).toBeGreaterThan(0);
    expect(secondMetrics?.inferenceMs).toBeGreaterThanOrEqual(0);

    tracker.pause();
    expect(video.cancelVideoFrameCallback).toHaveBeenCalled();
    tracker.resume();
    tracker.stop();
    expect(detector.close).toHaveBeenCalledTimes(1);
    expect(document.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
  });

  it('deduplicates initialization and closes a late detector after stop', async () => {
    const { video, detector, events } = fixture();
    let resolveDetector!: (detector: Detector) => void;
    const createDetector = vi.fn(
      () =>
        new Promise<Detector>((resolve) => {
          resolveDetector = resolve;
        }),
    );
    const tracker = new FaceTracker(createDetector, events);
    const first = tracker.start(video);
    const second = tracker.start(video);
    tracker.stop();
    resolveDetector(detector);
    await Promise.all([first, second]);
    expect(createDetector).toHaveBeenCalledTimes(1);
    expect(detector.close).toHaveBeenCalledTimes(1);
    expect(detector.detect).not.toHaveBeenCalled();
  });

  it('uses animation frames when video frame callbacks are unavailable', async () => {
    const { video, detector, events } = fixture();
    const frames: FrameRequestCallback[] = [];
    Object.defineProperty(video, 'requestVideoFrameCallback', {
      value: undefined,
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const tracker = new FaceTracker(async () => detector, events);
    await tracker.start(video);

    video.currentTime = 1;
    frames[0]!(100);
    video.currentTime = 1;
    frames[1]!(116);
    video.currentTime = 2;
    frames[2]!(132);
    expect(detector.detect).toHaveBeenCalledTimes(2);
    tracker.stop();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
