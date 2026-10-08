import {
  CameraFailure,
  CameraService,
  normalizeCameraError,
} from './CameraService';

interface CameraWorkspaceOptions {
  readonly title: string;
  readonly eyebrow: string;
  readonly onReady?: (video: HTMLVideoElement) => void;
  readonly onStopped?: () => void;
}

function button(label: string, className?: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  if (className) element.className = className;
  return element;
}

function text(
  tag: 'p' | 'h1' | 'label',
  value: string,
  className?: string,
): HTMLElement {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  return element;
}

/** Small M1 camera workspace shared by the app shell and the development lab. */
export class CameraWorkspace {
  readonly video = document.createElement('video');
  readonly previewFrame = document.createElement('div');
  readonly main = document.createElement('main');
  readonly cameraPane = document.createElement('div');

  private readonly camera = new CameraService(() => this.handleCameraEnded());
  private readonly startButton = button('Enable camera', 'primary-button');
  private readonly captureButton = button('Take photo');
  private readonly stopButton = button('Stop camera');
  private readonly deviceSelect = document.createElement('select');
  private readonly deviceRow = document.createElement('div');
  private readonly status = text('p', 'Camera off', 'camera-status');
  private readonly error = text('p', '', 'camera-error');
  private readonly capturedImage = document.createElement('img');
  private readonly captureResult = document.createElement('div');
  private photo: Blob | null = null;
  private captureUrl: string | null = null;
  private disposed = false;
  private busy = false;
  private capturing = false;
  private cameraVersion = 0;

  get capturedPhoto(): Blob | null {
    return this.photo;
  }

  constructor(
    host: HTMLElement,
    private readonly options: CameraWorkspaceOptions,
  ) {
    this.main.className = 'camera-workspace';
    const heading = text('h1', options.title);
    const intro = text(
      'p',
      'Keep your whole head and hair inside the guide. Captures stay in this browser for now.',
      'description',
    );

    this.previewFrame.className = 'preview-frame';
    this.video.className = 'camera-video';
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('aria-label', 'Mirrored live camera preview');
    const guide = document.createElement('div');
    guide.className = 'head-guide';
    guide.setAttribute('aria-hidden', 'true');
    this.previewFrame.append(this.video, guide);

    this.deviceRow.className = 'device-row';
    const deviceLabel = text('label', 'Camera', 'device-label');
    this.deviceSelect.id = 'camera-device';
    deviceLabel.setAttribute('for', this.deviceSelect.id);
    this.deviceRow.append(deviceLabel, this.deviceSelect);
    this.deviceRow.hidden = true;

    const actions = document.createElement('div');
    actions.className = 'camera-actions';
    this.captureButton.disabled = true;
    this.stopButton.disabled = true;
    actions.append(this.startButton, this.captureButton, this.stopButton);

    this.status.setAttribute('role', 'status');
    this.error.setAttribute('role', 'alert');
    this.error.hidden = true;
    this.captureResult.className = 'capture-result';
    this.captureResult.hidden = true;
    this.capturedImage.alt = 'Captured still image, displayed as a mirror';
    this.captureResult.append(
      text('p', 'Captured photo (kept in memory)', 'capture-label'),
      this.capturedImage,
    );

    this.cameraPane.className = 'camera-pane';
    this.cameraPane.append(
      this.previewFrame,
      this.deviceRow,
      actions,
      this.status,
      this.error,
      this.captureResult,
    );
    this.main.append(
      text('p', options.eyebrow, 'eyebrow'),
      heading,
      intro,
      this.cameraPane,
    );
    host.replaceChildren(this.main);

    this.startButton.addEventListener('click', () => void this.start());
    this.captureButton.addEventListener('click', () => void this.capture());
    this.stopButton.addEventListener('click', () => this.stop());
    this.deviceSelect.addEventListener(
      'change',
      () => void this.changeDevice(),
    );
    window.addEventListener('pagehide', this.handlePageHide);
  }

  private async start(deviceId?: string): Promise<void> {
    if (this.disposed || this.busy) return;
    const version = ++this.cameraVersion;
    this.busy = true;
    this.startButton.disabled = true;
    this.stopButton.disabled = false;
    this.setStatus('Starting camera…');
    this.setError(null);
    try {
      await this.camera.start(this.video, deviceId);
      if (this.disposed || !this.camera.active) return;
      this.previewFrame.style.aspectRatio = `${this.video.videoWidth} / ${this.video.videoHeight}`;
      this.captureButton.disabled = false;
      this.setStatus(
        this.photo
          ? 'Camera ready. Take another photo to replace the current one.'
          : 'Camera ready. Live frames stay on this device.',
      );
      void this.refreshDevices(version);
      this.options.onReady?.(this.video);
    } catch (error) {
      const failure = normalizeCameraError(error);
      if (failure.code !== 'camera_cancelled') this.setError(failure.message);
      this.setStatus('Camera off');
      this.stopButton.disabled = true;
    } finally {
      this.busy = false;
      this.startButton.disabled = this.camera.active || this.disposed;
    }
  }

  private async refreshDevices(version: number): Promise<void> {
    const devices = await this.camera.listVideoInputs();
    if (this.disposed || !this.camera.active || version !== this.cameraVersion)
      return;
    this.deviceSelect.replaceChildren();
    for (const [index, device] of devices.entries()) {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Camera ${index + 1}`;
      this.deviceSelect.append(option);
    }
    const activeId = this.camera.activeDeviceId;
    if (activeId) this.deviceSelect.value = activeId;
    this.deviceRow.hidden = devices.length < 2;
  }

  private async changeDevice(): Promise<void> {
    const deviceId = this.deviceSelect.value;
    if (!deviceId || this.busy) return;
    this.stop();
    await this.start(deviceId);
  }

  private async capture(): Promise<void> {
    if (this.capturing || this.disposed) return;
    const version = this.cameraVersion;
    this.capturing = true;
    this.captureButton.disabled = true;
    try {
      const blob = await this.camera.capture();
      if (
        this.disposed ||
        !this.camera.active ||
        version !== this.cameraVersion
      )
        return;
      const nextUrl = URL.createObjectURL(blob);
      const previousUrl = this.captureUrl;
      this.photo = blob;
      this.captureUrl = nextUrl;
      this.capturedImage.src = nextUrl;
      this.captureResult.hidden = false;
      if (previousUrl) URL.revokeObjectURL(previousUrl);
      this.setStatus('Photo captured in memory. No upload was made.');
      this.setError(null);
    } catch (error) {
      const failure =
        error instanceof CameraFailure
          ? error
          : new CameraFailure('camera_capture');
      this.setError(failure.message);
    } finally {
      this.capturing = false;
      this.captureButton.disabled = !this.camera.active || this.disposed;
    }
  }

  private clearCapture(): void {
    if (this.captureUrl) URL.revokeObjectURL(this.captureUrl);
    this.photo = null;
    this.captureUrl = null;
    this.capturedImage.removeAttribute('src');
    this.captureResult.hidden = true;
  }

  stop(): void {
    ++this.cameraVersion;
    this.options.onStopped?.();
    this.camera.stop();
    this.captureButton.disabled = true;
    this.stopButton.disabled = true;
    this.startButton.disabled = this.busy || this.disposed;
    this.deviceRow.hidden = true;
    this.previewFrame.style.aspectRatio = '';
    this.setStatus(
      this.photo
        ? 'Camera off. Your captured photo is still available.'
        : 'Camera off',
    );
  }

  private handleCameraEnded(): void {
    this.stop();
    this.setError('The camera disconnected. Reconnect it and try again.');
  }

  private readonly handlePageHide = (): void => this.dispose();

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('pagehide', this.handlePageHide);
    this.stop();
    this.clearCapture();
  }

  private setStatus(message: string): void {
    this.status.textContent = message;
  }

  private setError(message: string | null): void {
    this.error.textContent = message ?? '';
    this.error.hidden = message === null;
  }
}
