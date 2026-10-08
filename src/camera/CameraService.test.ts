import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraService, normalizeCameraError } from './CameraService';

function cameraFixture() {
  const track = {
    readyState: 'live',
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getSettings: () => ({ deviceId: 'camera-1' }),
  } as unknown as MediaStreamTrack;
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as MediaStream;
  const video = {
    autoplay: false,
    muted: false,
    playsInline: false,
    srcObject: null,
    videoWidth: 640,
    videoHeight: 480,
    play: vi.fn(async () => undefined),
    pause: vi.fn(),
  } as unknown as HTMLVideoElement;
  return { track, stream, video };
}

afterEach(() => vi.unstubAllGlobals());

describe('CameraService', () => {
  it('classifies permission failures without exposing browser error details', () => {
    expect(
      normalizeCameraError({
        name: 'NotAllowedError',
        message: 'private detail',
      }),
    ).toMatchObject({
      code: 'camera_permission',
    });
    expect(normalizeCameraError({ name: 'NotFoundError' })).toMatchObject({
      code: 'camera_unavailable',
    });
  });

  it('attaches an unmirrored stream once and releases its track on stop', async () => {
    const { track, stream, video } = cameraFixture();
    const getUserMedia = vi.fn(async () => stream);
    const camera = new CameraService(undefined, {
      getUserMedia,
      enumerateDevices: vi.fn(async () => []),
    } as unknown as MediaDevices);

    await camera.start(video);
    await camera.start(video);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBe(stream);
    expect(video.playsInline).toBe(true);
    expect(camera.activeDeviceId).toBe('camera-1');

    camera.stop();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBe(null);
    expect(camera.active).toBe(false);
  });

  it('stops a stream that arrives after cancellation', async () => {
    const { track, stream, video } = cameraFixture();
    let resolveStream!: (stream: MediaStream) => void;
    const getUserMedia = vi.fn(
      () =>
        new Promise<MediaStream>((resolve) => {
          resolveStream = resolve;
        }),
    );
    const camera = new CameraService(undefined, {
      getUserMedia,
      enumerateDevices: vi.fn(async () => []),
    } as unknown as MediaDevices);

    const opening = camera.start(video);
    camera.stop();
    resolveStream(stream);
    await expect(opening).rejects.toMatchObject({ code: 'camera_cancelled' });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBe(null);
  });

  it('cancels pending video playback and releases its stream', async () => {
    const { track, stream, video } = cameraFixture();
    video.play = vi.fn(() => new Promise<void>(() => undefined));
    const camera = new CameraService(undefined, {
      getUserMedia: vi.fn(async () => stream),
      enumerateDevices: vi.fn(async () => []),
    } as unknown as MediaDevices);

    const opening = camera.start(video);
    await Promise.resolve();
    camera.stop();
    await expect(opening).rejects.toMatchObject({ code: 'camera_cancelled' });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBe(null);
  });

  it('captures source pixels with no canvas mirror transform', async () => {
    const { stream, video } = cameraFixture();
    const drawImage = vi.fn();
    const transform = vi.fn();
    const blob = new Blob(['photo'], { type: 'image/jpeg' });
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage, transform }),
      toBlob: (callback: (value: Blob) => void) => callback(blob),
    };
    vi.stubGlobal('document', { createElement: () => canvas });
    const camera = new CameraService(undefined, {
      getUserMedia: vi.fn(async () => stream),
      enumerateDevices: vi.fn(async () => []),
    } as unknown as MediaDevices);

    await camera.start(video);
    expect(await camera.capture()).toBe(blob);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0);
    expect(transform).not.toHaveBeenCalled();
    expect(canvas).toMatchObject({ width: 640, height: 480 });
    camera.stop();
  });
});
