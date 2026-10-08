import type { TrackingObservation } from './observation';

export interface Detector {
  detect(video: HTMLVideoElement, timestampMs: number): TrackingObservation;
  close(): void;
}

export type TrackerStatus = 'idle' | 'loading' | 'running' | 'paused' | 'error';

export interface TrackerMetrics {
  readonly fps: number;
  readonly inferenceMs: number;
}

export interface TrackerEvents {
  onStatus(status: TrackerStatus): void;
  onObservation(
    observation: TrackingObservation,
    metrics: TrackerMetrics,
  ): void;
  onError(): void;
}

/** Schedules only fresh source frames. Inference is serialized and stops when hidden. */
export class FaceTracker {
  private detector: Detector | null = null;
  private video: HTMLVideoElement | null = null;
  private initializing: Promise<void> | null = null;
  private generation = 0;
  private active = false;
  private userPaused = false;
  private callbackId: number | null = null;
  private callbackKind: 'video' | 'animation' | null = null;
  private lastMediaTime = -1;
  private lastTimestampMs = -1;
  private frameTimes: number[] = [];

  constructor(
    private readonly createDetector: () => Promise<Detector>,
    private readonly events: TrackerEvents,
  ) {}

  async start(video: HTMLVideoElement): Promise<void> {
    if (this.active) return;
    if (this.initializing) return this.initializing;

    const generation = ++this.generation;
    this.events.onStatus('loading');
    const initialization = this.initialize(video, generation);
    this.initializing = initialization;
    try {
      await initialization;
    } finally {
      if (this.initializing === initialization) this.initializing = null;
    }
  }

  private async initialize(
    video: HTMLVideoElement,
    generation: number,
  ): Promise<void> {
    try {
      const detector = await this.createDetector();
      if (generation !== this.generation) {
        detector.close();
        return;
      }
      this.detector = detector;
      this.video = video;
      this.active = true;
      this.userPaused = false;
      this.lastMediaTime = -1;
      this.lastTimestampMs = -1;
      this.frameTimes = [];
      document.addEventListener(
        'visibilitychange',
        this.handleVisibilityChange,
      );
      this.updateScheduling();
    } catch {
      if (generation !== this.generation) return;
      this.events.onStatus('error');
      this.events.onError();
      throw new Error('Face tracker initialization failed');
    }
  }

  pause(): void {
    if (!this.active) return;
    this.userPaused = true;
    this.updateScheduling();
  }

  resume(): void {
    if (!this.active) return;
    this.userPaused = false;
    this.updateScheduling();
  }

  stop(): void {
    ++this.generation;
    this.active = false;
    this.cancelNextFrame();
    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    );
    this.detector?.close();
    this.detector = null;
    this.video = null;
    this.frameTimes = [];
    this.events.onStatus('idle');
  }

  private readonly handleVisibilityChange = (): void => {
    this.updateScheduling();
  };

  private updateScheduling(): void {
    if (!this.active || this.userPaused || document.hidden) {
      this.cancelNextFrame();
      if (this.active) this.events.onStatus('paused');
      return;
    }

    const video = this.video;
    if (!video) return;
    if (video.paused) {
      void video.play().then(
        () => this.updateScheduling(),
        () => this.fail(),
      );
      return;
    }
    this.events.onStatus('running');
    this.scheduleNextFrame();
  }

  private scheduleNextFrame(): void {
    const video = this.video;
    if (
      !this.active ||
      !video ||
      this.userPaused ||
      document.hidden ||
      this.callbackId !== null
    )
      return;
    const generation = this.generation;
    if (typeof video.requestVideoFrameCallback === 'function') {
      this.callbackKind = 'video';
      this.callbackId = video.requestVideoFrameCallback((now, metadata) => {
        if (generation !== this.generation) return;
        this.processFrame(now, metadata.mediaTime);
      });
    } else {
      this.callbackKind = 'animation';
      this.callbackId = requestAnimationFrame((now) => {
        if (generation !== this.generation) return;
        this.processFrame(now, video.currentTime);
      });
    }
  }

  private processFrame(now: number, mediaTime: number): void {
    this.callbackId = null;
    this.callbackKind = null;
    const video = this.video;
    const detector = this.detector;
    if (
      !this.active ||
      !video ||
      !detector ||
      this.userPaused ||
      document.hidden
    )
      return;
    if (
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      mediaTime === this.lastMediaTime
    ) {
      this.scheduleNextFrame();
      return;
    }

    this.lastMediaTime = mediaTime;
    const timestampMs = Math.max(now, this.lastTimestampMs + 0.001);
    this.lastTimestampMs = timestampMs;
    const inferenceStart = performance.now();
    try {
      const observation = detector.detect(video, timestampMs);
      const inferenceMs = performance.now() - inferenceStart;
      this.frameTimes.push(now);
      while (this.frameTimes.length > 1 && this.frameTimes[0]! < now - 1000) {
        this.frameTimes.shift();
      }
      const first = this.frameTimes[0] ?? now;
      const fps =
        now > first ? ((this.frameTimes.length - 1) * 1000) / (now - first) : 0;
      this.events.onObservation(observation, { fps, inferenceMs });
    } catch {
      this.fail();
      return;
    }
    this.scheduleNextFrame();
  }

  private fail(): void {
    this.stop();
    this.events.onStatus('error');
    this.events.onError();
  }

  private cancelNextFrame(): void {
    const video = this.video;
    if (this.callbackId !== null) {
      if (this.callbackKind === 'video' && video?.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(this.callbackId);
      } else if (this.callbackKind === 'animation') {
        cancelAnimationFrame(this.callbackId);
      }
    }
    this.callbackId = null;
    this.callbackKind = null;
  }
}
