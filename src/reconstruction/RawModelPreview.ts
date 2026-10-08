import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  inspectScene,
  validateGlbContainer,
  type AssetInspection,
} from './AssetInspection';

function disposeModel(root: Object3D): void {
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    (node.geometry as BufferGeometry).dispose();
    for (const material of Array.isArray(node.material)
      ? node.material
      : [node.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material))
        if (
          value &&
          typeof value === 'object' &&
          'isTexture' in value &&
          value.isTexture
        )
          textures.add(value as Texture);
    }
  });
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
}

/** Independent raw reconstruction viewer. No facial rig or semantic animation implied. */
export class RawModelPreview {
  private readonly canvas = document.createElement('canvas');
  private readonly renderer: WebGLRenderer;
  private readonly camera = new PerspectiveCamera(35, 1, 0.01, 100);
  private readonly scene = new Scene();
  private readonly orbit: OrbitControls;
  private readonly orientation = new Group();
  private readonly observer: ResizeObserver | null;
  private model: Object3D | null = null;
  private disposed = false;
  private running = false;
  private contextLost = false;

  private constructor(private readonly host: HTMLElement) {
    this.canvas.className = 'reconstruction-canvas';
    this.canvas.setAttribute('aria-label', 'Orbitable reconstructed 3D head');
    const context = this.canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
    });
    if (!context) throw new Error('WebGL2 is unavailable in this browser.');
    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      context,
      antialias: true,
    });
    this.renderer.setClearColor(new Color(0xe9e7e1));
    this.scene.background = new Color(0xe9e7e1);
    this.scene.add(new HemisphereLight(0xffffff, 0x777a74, 2));
    this.scene.add(new AmbientLight(0xffffff, 0.25));
    const key = new DirectionalLight(0xffffff, 2.4);
    key.position.set(-3, 4, 5);
    this.scene.add(key);
    const rim = new DirectionalLight(0xffffff, 1);
    rim.position.set(3, 1, -4);
    this.scene.add(rim);
    this.scene.add(this.orientation);
    this.camera.position.set(0, 0, 5.2);
    this.camera.lookAt(0, 0, 0);
    this.orbit = new OrbitControls(this.camera, this.canvas);
    this.orbit.enableDamping = true;
    this.orbit.minDistance = 2;
    this.orbit.maxDistance = 12;
    this.orbit.target.set(0, 0, 0);
    host.append(this.canvas);
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener(
      'webglcontextrestored',
      this.onContextRestored,
    );
    document.addEventListener('visibilitychange', this.onVisibility);
    this.observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => this.resize());
    if (this.observer) this.observer.observe(host);
    else window.addEventListener('resize', this.resize);
    this.resize();
  }

  static async create(
    host: HTMLElement,
    blob: Blob,
    sourceUrl: string,
  ): Promise<{ preview: RawModelPreview; inspection: AssetInspection }> {
    const bytes = await blob.arrayBuffer();
    validateGlbContainer(bytes);
    const base = new URL('.', sourceUrl).href;
    const gltf = await new GLTFLoader().parseAsync(bytes, base);
    let preview: RawModelPreview | null = null;
    try {
      const inspection = inspectScene(gltf.scene, bytes.byteLength);
      const box = new Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new Vector3());
      const normalized = new Group();
      normalized.scale.setScalar(inspection.scaleToAvatar);
      gltf.scene.position.sub(center);
      normalized.add(gltf.scene);
      gltf.scene.traverse((node) => {
        if (
          node instanceof Mesh &&
          !(node.geometry as BufferGeometry).getAttribute('normal')
        )
          (node.geometry as BufferGeometry).computeVertexNormals();
      });
      preview = new RawModelPreview(host);
      preview.model = gltf.scene;
      preview.orientation.add(normalized);
      preview.start();
      return { preview, inspection };
    } catch (error) {
      preview?.dispose();
      if (!preview) disposeModel(gltf.scene);
      throw error;
    }
  }

  setYaw(degrees: number): void {
    this.orientation.rotation.y = (degrees * Math.PI) / 180;
  }

  private readonly resize = (): void => {
    if (this.disposed) return;
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (!width || !height) return;
    this.renderer.setPixelRatio(
      Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
    );
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private readonly frame = (): void => {
    if (!this.running || this.disposed || this.contextLost) return;
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
  };

  private start(): void {
    if (this.disposed || this.running || this.contextLost || document.hidden)
      return;
    this.running = true;
    this.renderer.setAnimationLoop(this.frame);
  }

  private stop(): void {
    if (!this.running) return;
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };
  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.stop();
  };
  private readonly onContextRestored = (): void => {
    this.contextLost = false;
    this.resize();
    this.start();
  };

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.observer?.disconnect();
    if (!this.observer) window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener(
      'webglcontextrestored',
      this.onContextRestored,
    );
    this.orbit.dispose();
    if (this.model) disposeModel(this.model);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
