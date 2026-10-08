import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from 'three';
import type { AvatarControlState } from './AvatarControlState';
import type { AvatarRigAdapter } from './AvatarRigAdapter';

export interface RenderStats {
  readonly fps: number;
  readonly frameP50Ms: number;
  readonly frameP95Ms: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly geometries: number;
  readonly textures: number;
  readonly dpr: number;
}

function percentile(
  samples: Float32Array,
  count: number,
  fraction: number,
): number {
  if (count === 0) return 0;
  const sorted = Array.from(samples.subarray(0, count)).sort((a, b) => a - b);
  return sorted[Math.min(count - 1, Math.floor((count - 1) * fraction))]!;
}

/** WebGL2-only renderer. It owns the render clock, scene, resize, and GPU lifecycle. */
export class AvatarRenderer {
  readonly canvas = document.createElement('canvas');
  readonly camera = new PerspectiveCamera(35, 1, 0.1, 100);
  private readonly scene = new Scene();
  private readonly renderer: WebGLRenderer;
  private readonly frameTimes = new Float32Array(120);
  private readonly resizeObserver: ResizeObserver | null;
  private frameCount = 0;
  private frameSampleCount = 0;
  private frameSampleIndex = 0;
  private statsStartMs = 0;
  private running = false;
  private contextLost = false;
  private disposed = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly rig: AvatarRigAdapter,
    private readonly controls: AvatarControlState,
    private readonly beforeFrame?: (nowMs: number) => void,
    private readonly onStats?: (stats: RenderStats) => void,
    private readonly onStatus?: (message: string) => void,
  ) {
    this.canvas.className = 'avatar-canvas';
    this.canvas.setAttribute('aria-label', 'Animated 3D avatar fixture');
    const context = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    });
    if (!context) throw new Error('WebGL2 is unavailable in this browser.');
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      context,
      antialias: true,
    });
    this.renderer.setClearColor(new Color(0xe9e7e1), 1);
    this.scene.background = new Color(0xe9e7e1);
    this.scene.add(new HemisphereLight(0xffffff, 0x8c887e, 2.0));
    this.scene.add(new AmbientLight(0xffffff, 0.35));
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(-2, 3, 4);
    this.scene.add(key);
    const rim = new DirectionalLight(0xe7edff, 0.8);
    rim.position.set(2, 1, -3);
    this.scene.add(rim);
    this.scene.add(rig.root);
    this.camera.position.set(0, 0, 4.7);
    this.camera.lookAt(0, 0, 0);
    host.append(this.canvas);
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.addEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
    );
    document.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('pagehide', this.handlePageHide);
    this.resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => this.resize());
    if (this.resizeObserver) this.resizeObserver.observe(host);
    else window.addEventListener('resize', this.resize);
    this.resize();
  }

  readonly resize = (): void => {
    if (this.disposed) return;
    const width = Math.floor(this.host.clientWidth);
    const height = Math.floor(this.host.clientHeight);
    if (width < 1 || height < 1) return;
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  start(): void {
    if (this.disposed || this.contextLost || this.running || document.hidden)
      return;
    this.running = true;
    this.frameCount = 0;
    this.frameSampleCount = 0;
    this.frameSampleIndex = 0;
    this.statsStartMs = performance.now();
    this.renderer.setAnimationLoop(this.renderFrame);
    this.onStatus?.('Rendering');
  }

  getCapabilities(): { maxTextureSize: number; precision: string } {
    return {
      maxTextureSize: this.renderer.capabilities.maxTextureSize,
      precision: this.renderer.capabilities.precision,
    };
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.onStatus?.('Paused');
  }

  private readonly renderFrame = (nowMs: number): void => {
    if (!this.running || this.disposed || this.contextLost) return;
    const startMs = performance.now();
    this.beforeFrame?.(nowMs);
    this.rig.apply(this.controls);
    this.renderer.render(this.scene, this.camera);
    this.frameTimes[this.frameSampleIndex] = performance.now() - startMs;
    this.frameSampleIndex =
      (this.frameSampleIndex + 1) % this.frameTimes.length;
    this.frameSampleCount = Math.min(
      this.frameSampleCount + 1,
      this.frameTimes.length,
    );
    this.frameCount++;
    const elapsed = nowMs - this.statsStartMs;
    if (elapsed < 500) return;
    const info = this.renderer.info;
    this.onStats?.({
      fps: (this.frameCount * 1000) / elapsed,
      frameP50Ms: percentile(this.frameTimes, this.frameSampleCount, 0.5),
      frameP95Ms: percentile(this.frameTimes, this.frameSampleCount, 0.95),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      dpr: this.renderer.getPixelRatio(),
    });
    this.frameCount = 0;
    this.statsStartMs = nowMs;
  };

  private readonly handleVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.stop();
    this.onStatus?.('WebGL context lost');
  };

  private readonly handleContextRestored = (): void => {
    this.contextLost = false;
    this.resize();
    this.start();
  };

  private readonly handlePageHide = (): void => this.dispose();

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.resizeObserver?.disconnect();
    if (!this.resizeObserver) window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('pagehide', this.handlePageHide);
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestored,
    );
    this.rig.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.onStatus?.('Disposed');
  }
}
