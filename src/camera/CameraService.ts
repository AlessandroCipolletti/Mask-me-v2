export type CameraFailureCode =
  | 'camera_permission'
  | 'camera_unavailable'
  | 'camera_playback'
  | 'camera_capture'
  | 'camera_cancelled';

const messages: Record<CameraFailureCode, string> = {
  camera_permission:
    'Camera access was denied. Allow access in your browser settings and try again.',
  camera_unavailable:
    'No usable camera is available. Check the connection and close other camera apps.',
  camera_playback:
    'The camera opened but the preview could not start. Try again.',
  camera_capture: 'The camera frame could not be captured. Try again.',
  camera_cancelled: 'Camera start was cancelled.',
};

export class CameraFailure extends Error {
  constructor(readonly code: CameraFailureCode) {
    super(messages[code]);
    this.name = 'CameraFailure';
  }
}

export function normalizeCameraError(error: unknown): CameraFailure {
  if (error instanceof CameraFailure) return error;
  const name =
    error && typeof error === 'object' && 'name' in error ? error.name : null;
  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    name === 'SecurityError'
  ) {
    return new CameraFailure('camera_permission');
  }
  return new CameraFailure('camera_unavailable');
}

type CameraDevices = Pick<MediaDevices, 'getUserMedia' | 'enumerateDevices'>;

function whileNotAborted<T>(
  operation: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cancel = () => reject(new CameraFailure('camera_cancelled'));
    if (signal.aborted) {
      cancel();
      return;
    }
    signal.addEventListener('abort', cancel, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener('abort', cancel);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', cancel);
        reject(error);
      },
    );
  });
}

function waitForVideoDimensions(
  video: HTMLVideoElement,
  signal: AbortSignal,
): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', check);
      video.removeEventListener('resize', check);
      signal.removeEventListener('abort', cancel);
      clearTimeout(timeout);
    };
    const check = () => {
      if (video.videoWidth === 0 || video.videoHeight === 0) return;
      cleanup();
      resolve();
    };
    const cancel = () => {
      cleanup();
      reject(new CameraFailure('camera_cancelled'));
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new CameraFailure('camera_playback'));
    }, 5000);
    video.addEventListener('loadedmetadata', check);
    video.addEventListener('resize', check);
    signal.addEventListener('abort', cancel, { once: true });
    check();
  });
}

/** Owns the unmirrored source stream, its video attachment, and still capture. */
export class CameraService {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private pending: Promise<void> | null = null;
  private startupAbort: AbortController | null = null;
  private generation = 0;

  constructor(
    private readonly onEnded?: () => void,
    private readonly devices: CameraDevices | null = typeof navigator ===
    'undefined'
      ? null
      : (navigator.mediaDevices ?? null),
  ) {}

  get active(): boolean {
    return this.stream !== null;
  }

  get activeDeviceId(): string | undefined {
    return this.videoTrack?.getSettings().deviceId;
  }

  async start(video: HTMLVideoElement, deviceId?: string): Promise<void> {
    if (this.stream) return;
    if (this.pending) return this.pending;

    const generation = ++this.generation;
    const request = this.open(video, deviceId, generation);
    this.pending = request;
    try {
      await request;
    } finally {
      if (this.pending === request) this.pending = null;
    }
  }

  private async open(
    video: HTMLVideoElement,
    deviceId: string | undefined,
    generation: number,
  ): Promise<void> {
    if (!this.devices?.getUserMedia)
      throw new CameraFailure('camera_unavailable');

    let acquired: MediaStream | null = null;
    let startup: AbortController | null = null;
    try {
      acquired = await this.devices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          ...(deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: 'user' }),
        },
      });
      if (generation !== this.generation)
        throw new CameraFailure('camera_cancelled');

      startup = new AbortController();
      this.startupAbort = startup;

      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = acquired;
      this.video = video;
      try {
        await whileNotAborted(video.play(), startup.signal);
        await waitForVideoDimensions(video, startup.signal);
      } catch {
        if (generation !== this.generation)
          throw new CameraFailure('camera_cancelled');
        throw new CameraFailure('camera_playback');
      }
      if (generation !== this.generation)
        throw new CameraFailure('camera_cancelled');

      const track = acquired.getVideoTracks()[0];
      if (!track || track.readyState === 'ended') {
        throw new CameraFailure('camera_unavailable');
      }
      this.stream = acquired;
      this.videoTrack = track;
      track.addEventListener('ended', this.handleTrackEnded);
    } catch (error) {
      acquired?.getTracks().forEach((track) => track.stop());
      if (video.srcObject === acquired) {
        video.pause();
        video.srcObject = null;
      }
      if (this.video === video) this.video = null;
      if (generation !== this.generation)
        throw new CameraFailure('camera_cancelled');
      throw normalizeCameraError(error);
    } finally {
      if (this.startupAbort === startup) this.startupAbort = null;
    }
  }

  async listVideoInputs(): Promise<MediaDeviceInfo[]> {
    if (!this.devices?.enumerateDevices) return [];
    try {
      return (await this.devices.enumerateDevices()).filter(
        (device) => device.kind === 'videoinput',
      );
    } catch {
      return [];
    }
  }

  async capture(): Promise<Blob> {
    const video = this.video;
    if (
      !this.stream ||
      !video ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      throw new CameraFailure('camera_capture');
    }

    // CSS mirrors the preview only. The captured source pixels keep camera orientation.
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new CameraFailure('camera_capture');
    context.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (!blob) throw new CameraFailure('camera_capture');
    return blob;
  }

  stop(): void {
    ++this.generation;
    this.startupAbort?.abort();
    this.startupAbort = null;
    this.videoTrack?.removeEventListener('ended', this.handleTrackEnded);
    this.videoTrack = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
  }

  private readonly handleTrackEnded = (): void => {
    this.stop();
    this.onEnded?.();
  };
}
