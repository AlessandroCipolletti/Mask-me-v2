import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraWorkspace } from './CameraWorkspace';

class ElementFixture {
  readonly children: unknown[] = [];
  readonly style: Record<string, string> = {};
  readonly classList = { add: vi.fn() };
  private readonly listeners = new Map<string, Array<() => void>>();
  className = '';
  textContent = '';
  hidden = false;
  disabled = false;
  src = '';
  srcObject: MediaStream | null = null;
  videoWidth = 640;
  videoHeight = 480;
  play = vi.fn(async () => undefined);
  pause = vi.fn();
  focus = vi.fn();

  constructor(readonly tag: string) {}

  append(...children: unknown[]): void {
    this.children.push(...children);
  }

  replaceChildren(...children: unknown[]): void {
    this.children.splice(0, this.children.length, ...children);
  }

  setAttribute(): void {}
  removeAttribute(): void {
    this.src = '';
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((item) => item !== listener),
    );
  }

  click(): void {
    for (const listener of this.listeners.get('click') ?? []) listener();
  }

  getContext(): { drawImage: () => void } {
    return { drawImage: vi.fn() };
  }

  toBlob(callback: (blob: Blob) => void): void {
    callback(new Blob([`photo-${++photoSequence}`], { type: 'image/jpeg' }));
  }
}

let photoSequence = 0;

function findElement(
  root: ElementFixture,
  matches: (element: ElementFixture) => boolean,
): ElementFixture | null {
  if (matches(root)) return root;
  for (const child of root.children) {
    if (child instanceof ElementFixture) {
      const found = findElement(child, matches);
      if (found) return found;
    }
  }
  return null;
}

function findButton(root: ElementFixture, label: string): ElementFixture {
  const found = findElement(
    root,
    (element) => element.tag === 'button' && element.textContent === label,
  );
  if (found) return found;
  throw new Error(`Button ${label} not found`);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CameraWorkspace photo lifecycle', () => {
  it('keeps a photo after stop and through retake until a new capture replaces it', async () => {
    photoSequence = 0;
    const tracks: Array<{ stop: ReturnType<typeof vi.fn> }> = [];
    const getUserMedia = vi.fn(async () => {
      const track = {
        readyState: 'live',
        stop: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getSettings: () => ({ deviceId: 'camera-1' }),
      };
      tracks.push(track);
      return {
        getTracks: () => [track],
        getVideoTracks: () => [track],
      } as unknown as MediaStream;
    });
    const createObjectURL = vi.fn((object: Blob | MediaSource) => {
      expect(object).toBeInstanceOf(Blob);
      return `blob:photo-${photoSequence}`;
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia, enumerateDevices: async () => [] },
    });
    vi.stubGlobal('document', {
      createElement: (tag: string) => new ElementFixture(tag),
    });
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURL);

    const host = new ElementFixture('div');
    const workspace = new CameraWorkspace(host as unknown as HTMLElement, {
      title: 'Camera',
      eyebrow: 'Test',
    });
    const main = workspace.main as unknown as ElementFixture;
    findButton(main, 'Enable camera').click();
    await vi.waitFor(() =>
      expect(findButton(main, 'Take photo').disabled).toBe(false),
    );

    findButton(main, 'Take photo').click();
    await vi.waitFor(() => expect(workspace.capturedPhoto).not.toBeNull());
    const firstPhoto = workspace.capturedPhoto;
    const firstUrl = createObjectURL.mock.results[0]?.value;
    const image = findElement(main, (element) => element.tag === 'img');
    const captureResult = findElement(
      main,
      (element) => element.className === 'capture-result',
    );
    expect(image?.src).toBe(firstUrl);
    expect(captureResult?.hidden).toBe(false);

    findButton(main, 'Retake photo').click();
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(workspace.capturedPhoto).toBe(firstPhoto);
    findButton(main, 'Take photo').click();
    await vi.waitFor(() =>
      expect(workspace.capturedPhoto).not.toBe(firstPhoto),
    );
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(firstUrl);
    const secondPhoto = workspace.capturedPhoto;

    findButton(main, 'Stop camera').click();
    expect(tracks[0]?.stop).toHaveBeenCalledOnce();
    expect(workspace.capturedPhoto).toBe(secondPhoto);
    expect(captureResult?.hidden).toBe(false);
    expect(image?.src).toBe(createObjectURL.mock.results[1]?.value);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    findButton(main, 'Retake photo').click();
    await vi.waitFor(() =>
      expect(findButton(main, 'Take photo').disabled).toBe(false),
    );
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(workspace.capturedPhoto).toBe(secondPhoto);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    findButton(main, 'Take photo').click();
    await vi.waitFor(() =>
      expect(workspace.capturedPhoto).not.toBe(secondPhoto),
    );
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);

    workspace.dispose();
    expect(tracks[1]?.stop).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledTimes(3);
    expect(workspace.capturedPhoto).toBeNull();
  });
});
