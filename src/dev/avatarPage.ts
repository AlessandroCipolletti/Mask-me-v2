import './avatarPage.css';
import { Box3, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { type AvatarControlState } from '../avatar/AvatarControlState';
import { AvatarRenderer, type RenderStats } from '../avatar/AvatarRenderer';
import { KnownGoodAvatar } from '../avatar/KnownGoodAvatar';
import {
  referencePoses,
  SyntheticControlSource,
} from '../avatar/SyntheticControlSource';

interface SliderSpec {
  readonly section: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly read: (state: AvatarControlState) => number;
  readonly write: (state: AvatarControlState, value: number) => void;
  readonly format?: (value: number) => string;
}

const deg = (radians: number): number => (radians * 180) / Math.PI;
const rad = (degrees: number): number => (degrees * Math.PI) / 180;
const angle = (
  section: string,
  label: string,
  read: SliderSpec['read'],
  write: SliderSpec['write'],
  range = 60,
): SliderSpec => ({
  section,
  label,
  min: -range,
  max: range,
  step: 1,
  read: (state) => deg(read(state)),
  write: (state, value) => write(state, rad(value)),
  format: (value) => `${value.toFixed(0)}°`,
});
const scalar = (
  section: string,
  label: string,
  read: SliderSpec['read'],
  write: SliderSpec['write'],
): SliderSpec => ({
  section,
  label,
  min: 0,
  max: 1,
  step: 0.01,
  read,
  write,
});

const sliders: readonly SliderSpec[] = [
  angle(
    'Head',
    'Yaw',
    (s) => s.head.yaw,
    (s, v) => {
      s.head.yaw = v;
    },
    180,
  ),
  angle(
    'Head',
    'Pitch',
    (s) => s.head.pitch,
    (s, v) => {
      s.head.pitch = v;
    },
    45,
  ),
  angle(
    'Head',
    'Roll',
    (s) => s.head.roll,
    (s, v) => {
      s.head.roll = v;
    },
    45,
  ),
  {
    section: 'Head',
    label: 'Translate X',
    min: -0.5,
    max: 0.5,
    step: 0.01,
    read: (s) => s.head.tx,
    write: (s, v) => {
      s.head.tx = v;
    },
  },
  {
    section: 'Head',
    label: 'Translate Y',
    min: -0.5,
    max: 0.5,
    step: 0.01,
    read: (s) => s.head.ty,
    write: (s, v) => {
      s.head.ty = v;
    },
  },
  {
    section: 'Head',
    label: 'Translate Z',
    min: -0.5,
    max: 0.5,
    step: 0.01,
    read: (s) => s.head.tz,
    write: (s, v) => {
      s.head.tz = v;
    },
  },
  angle(
    'Eyes',
    'Left gaze yaw',
    (s) => s.eyes.left.yaw,
    (s, v) => {
      s.eyes.left.yaw = v;
    },
    30,
  ),
  angle(
    'Eyes',
    'Right gaze yaw',
    (s) => s.eyes.right.yaw,
    (s, v) => {
      s.eyes.right.yaw = v;
    },
    30,
  ),
  angle(
    'Eyes',
    'Left gaze pitch',
    (s) => s.eyes.left.pitch,
    (s, v) => {
      s.eyes.left.pitch = v;
    },
    25,
  ),
  angle(
    'Eyes',
    'Right gaze pitch',
    (s) => s.eyes.right.pitch,
    (s, v) => {
      s.eyes.right.pitch = v;
    },
    25,
  ),
  scalar(
    'Eyes',
    'Blink left',
    (s) => s.eyes.left.blink,
    (s, v) => {
      s.eyes.left.blink = v;
    },
  ),
  scalar(
    'Eyes',
    'Blink right',
    (s) => s.eyes.right.blink,
    (s, v) => {
      s.eyes.right.blink = v;
    },
  ),
  scalar(
    'Eyes',
    'Blink both',
    (s) => Math.min(s.eyes.left.blink, s.eyes.right.blink),
    (s, v) => {
      s.eyes.left.blink = s.eyes.right.blink = v;
    },
  ),
  scalar(
    'Brows',
    'Left up',
    (s) => s.brows.leftUp,
    (s, v) => {
      s.brows.leftUp = v;
    },
  ),
  scalar(
    'Brows',
    'Right up',
    (s) => s.brows.rightUp,
    (s, v) => {
      s.brows.rightUp = v;
    },
  ),
  scalar(
    'Brows',
    'Left down',
    (s) => s.brows.leftDown,
    (s, v) => {
      s.brows.leftDown = v;
    },
  ),
  scalar(
    'Brows',
    'Right down',
    (s) => s.brows.rightDown,
    (s, v) => {
      s.brows.rightDown = v;
    },
  ),
  scalar(
    'Brows',
    'Inner up',
    (s) => s.brows.innerUp,
    (s, v) => {
      s.brows.innerUp = v;
    },
  ),
  scalar(
    'Jaw',
    'Open',
    (s) => s.jaw.open,
    (s, v) => {
      s.jaw.open = v;
    },
  ),
  scalar(
    'Mouth',
    'Close',
    (s) => s.mouth.close,
    (s, v) => {
      s.mouth.close = v;
    },
  ),
  scalar(
    'Mouth',
    'Smile left',
    (s) => s.mouth.smileLeft,
    (s, v) => {
      s.mouth.smileLeft = v;
    },
  ),
  scalar(
    'Mouth',
    'Smile right',
    (s) => s.mouth.smileRight,
    (s, v) => {
      s.mouth.smileRight = v;
    },
  ),
  scalar(
    'Mouth',
    'Frown left',
    (s) => s.mouth.frownLeft,
    (s, v) => {
      s.mouth.frownLeft = v;
    },
  ),
  scalar(
    'Mouth',
    'Frown right',
    (s) => s.mouth.frownRight,
    (s, v) => {
      s.mouth.frownRight = v;
    },
  ),
  scalar(
    'Mouth',
    'Funnel',
    (s) => s.mouth.funnel,
    (s, v) => {
      s.mouth.funnel = v;
    },
  ),
  scalar(
    'Mouth',
    'Pucker',
    (s) => s.mouth.pucker,
    (s, v) => {
      s.mouth.pucker = v;
    },
  ),
  scalar(
    'Mouth',
    'Left',
    (s) => s.mouth.left,
    (s, v) => {
      s.mouth.left = v;
    },
  ),
  scalar(
    'Mouth',
    'Right',
    (s) => s.mouth.right,
    (s, v) => {
      s.mouth.right = v;
    },
  ),
  scalar(
    'Mouth',
    'Upper up left',
    (s) => s.mouth.upperUpLeft,
    (s, v) => {
      s.mouth.upperUpLeft = v;
    },
  ),
  scalar(
    'Mouth',
    'Upper up right',
    (s) => s.mouth.upperUpRight,
    (s, v) => {
      s.mouth.upperUpRight = v;
    },
  ),
  scalar(
    'Mouth',
    'Lower down left',
    (s) => s.mouth.lowerDownLeft,
    (s, v) => {
      s.mouth.lowerDownLeft = v;
    },
  ),
  scalar(
    'Mouth',
    'Lower down right',
    (s) => s.mouth.lowerDownRight,
    (s, v) => {
      s.mouth.lowerDownRight = v;
    },
  ),
  scalar(
    'Cheeks',
    'Left squint',
    (s) => s.cheeks.leftSquint,
    (s, v) => {
      s.cheeks.leftSquint = v;
    },
  ),
  scalar(
    'Cheeks',
    'Right squint',
    (s) => s.cheeks.rightSquint,
    (s, v) => {
      s.cheeks.rightSquint = v;
    },
  ),
];

function text(
  tag: 'h1' | 'h2' | 'p' | 'span' | 'pre',
  value: string,
): HTMLElement {
  const element = document.createElement(tag);
  element.textContent = value;
  return element;
}

function button(label: string): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  return element;
}

export function mountAvatarLab(host: HTMLElement): void {
  const source = new SyntheticControlSource();
  const rig = new KnownGoodAvatar();
  const main = document.createElement('main');
  main.className = 'avatar-lab';
  const heading = text('h1', 'Avatar lab');
  const intro = text(
    'p',
    'A deterministic complete-head fixture driven by semantic controls. No webcam or generation required. Drag to orbit; scroll to zoom.',
  );
  const viewport = document.createElement('div');
  viewport.className = 'avatar-viewport';
  const controlsPane = document.createElement('section');
  controlsPane.className = 'avatar-controls';
  const diagnostics = document.createElement('section');
  diagnostics.className = 'avatar-diagnostics';
  main.append(heading, intro, viewport, controlsPane, diagnostics);
  host.replaceChildren(main);

  const poseSelect = document.createElement('select');
  poseSelect.setAttribute('aria-label', 'Reference pose');
  for (const pose of referencePoses) {
    const option = document.createElement('option');
    option.value = pose.id;
    option.textContent = pose.label;
    poseSelect.append(option);
  }
  const customOption = document.createElement('option');
  customOption.value = 'custom';
  customOption.textContent = 'Custom / sweep';
  customOption.disabled = true;
  poseSelect.append(customOption);
  const sequenceButton = button('Play reference poses');
  const sweepButton = button('Continuous sweep');
  const stopButton = button('Stop animation');
  const toolbar = document.createElement('div');
  toolbar.className = 'avatar-toolbar';
  toolbar.append(poseSelect, sequenceButton, sweepButton, stopButton);
  controlsPane.append(toolbar);

  const sliderValues: Array<{
    spec: SliderSpec;
    input: HTMLInputElement;
    output: HTMLElement;
  }> = [];
  let section = '';
  let group: HTMLElement | null = null;
  for (const spec of sliders) {
    if (spec.section !== section) {
      section = spec.section;
      group = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = section;
      group.append(legend);
      controlsPane.append(group);
    }
    const label = document.createElement('label');
    label.className = 'avatar-slider';
    const name = text('span', spec.label);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    const output = text('span', '');
    output.className = 'avatar-slider-value';
    label.append(name, input, output);
    group!.append(label);
    input.addEventListener('input', () => {
      source.edit((state) => spec.write(state, Number(input.value)));
      updateReadout();
    });
    sliderValues.push({ spec, input, output });
  }

  const status = text('p', 'Starting renderer…');
  status.setAttribute('role', 'status');
  const performance = text('p', 'Render FPS: —');
  const capability = text('p', 'WebGL2');
  const bounds = text('p', 'Bounds: —');
  const manifest = text('pre', JSON.stringify(rig.manifest, null, 2));
  const applied = text('pre', '');
  diagnostics.append(
    text('h2', 'Runtime'),
    status,
    performance,
    capability,
    bounds,
    text('h2', 'Applied semantic controls'),
    applied,
    text('h2', 'Fixture manifest'),
    manifest,
    text(
      'p',
      'Morph targets: none. This fixture maps semantic controls to named mesh transforms. Future prepared rigs implement the same adapter.',
    ),
  );

  const box = new Box3();
  const size = new Vector3();
  function updateReadout(stats?: RenderStats): void {
    poseSelect.value =
      source.poseIndex === null
        ? 'custom'
        : referencePoses[source.poseIndex]!.id;
    for (const { spec, input, output } of sliderValues) {
      const value = spec.read(source.state);
      input.value = String(value);
      output.textContent = spec.format?.(value) ?? value.toFixed(2);
    }
    applied.textContent = JSON.stringify(source.state, null, 2);
    rig.root.updateMatrixWorld(true);
    box.setFromObject(rig.root).getSize(size);
    bounds.textContent = `Bounds: ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} avatar units`;
    if (stats)
      performance.textContent = `Render ${stats.fps.toFixed(1)} FPS · CPU frame p50 ${stats.frameP50Ms.toFixed(1)} ms / p95 ${stats.frameP95Ms.toFixed(1)} ms · ${stats.drawCalls} calls · ${stats.triangles} triangles · ${stats.geometries} geometries · ${stats.textures} textures · DPR ${stats.dpr.toFixed(1)}`;
  }

  let renderer: AvatarRenderer;
  try {
    renderer = new AvatarRenderer(
      viewport,
      rig,
      source.state,
      (nowMs) => source.update(nowMs),
      updateReadout,
      (message) => {
        status.textContent = message;
      },
    );
  } catch (error) {
    rig.dispose();
    status.textContent =
      error instanceof Error ? error.message : 'Renderer could not start.';
    updateReadout();
    return;
  }
  const capabilities = renderer.getCapabilities();
  capability.textContent = `WebGL2 · max texture ${capabilities.maxTextureSize} · precision ${capabilities.precision}`;
  const orbit = new OrbitControls(renderer.camera, renderer.canvas);
  orbit.enableDamping = false;
  orbit.minDistance = 2.7;
  orbit.maxDistance = 8;
  orbit.target.set(0, 0, 0);
  orbit.update();

  poseSelect.addEventListener('change', () => {
    const index = referencePoses.findIndex(
      (pose) => pose.id === poseSelect.value,
    );
    source.selectPose(index);
    updateReadout();
  });
  sequenceButton.addEventListener('click', () =>
    source.startSequence(performanceNow()),
  );
  sweepButton.addEventListener('click', () =>
    source.startSweep(performanceNow()),
  );
  stopButton.addEventListener('click', () => source.stop());
  function performanceNow(): number {
    return window.performance.now();
  }
  updateReadout();
  renderer.start();
  window.addEventListener('pagehide', () => orbit.dispose(), { once: true });
}
