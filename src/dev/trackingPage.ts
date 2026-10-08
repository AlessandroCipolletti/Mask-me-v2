import './trackingPage.css';
import { CameraWorkspace } from '../camera/CameraWorkspace';
import {
  FaceTracker,
  type TrackerMetrics,
  type TrackerStatus,
} from '../tracking/FaceTracker';
import { createMediaPipeDetector } from '../tracking/MediaPipeDetector';
import {
  isFaceNearFrameEdge,
  type TrackingObservation,
} from '../tracking/observation';

function field(label: string): { row: HTMLDivElement; value: HTMLElement } {
  const row = document.createElement('div');
  row.className = 'diagnostic-row';
  const name = document.createElement('span');
  name.textContent = label;
  const value = document.createElement('strong');
  value.textContent = '—';
  row.append(name, value);
  return { row, value };
}

function formatAngle(radians: number): string {
  return `${((radians * 180) / Math.PI).toFixed(1)}°`;
}

export function mountTrackingLab(host: HTMLElement): void {
  const statusField = field('Tracker');
  const faceField = field('Face');
  const confidenceField = field('Confidence');
  const fpsField = field('Tracking FPS');
  const inferenceField = field('Inference');
  const yawField = field('Raw yaw');
  const pitchField = field('Raw pitch');
  const rollField = field('Raw roll');
  const translationField = field('Raw translation');
  const framingField = field('Framing');
  const matrix = document.createElement('pre');
  matrix.className = 'matrix-output';
  matrix.textContent = 'No face matrix yet';
  const blendshapeBody = document.createElement('tbody');
  const blendshapeRows = new Map<string, HTMLElement>();
  const trackerError = document.createElement('p');
  trackerError.className = 'camera-error';
  trackerError.setAttribute('role', 'alert');
  trackerError.hidden = true;
  let lastTextUpdateMs = -Infinity;

  const pauseButton = document.createElement('button');
  pauseButton.type = 'button';
  pauseButton.textContent = 'Pause tracking';
  pauseButton.disabled = true;

  const overlayToggle = document.createElement('input');
  overlayToggle.type = 'checkbox';
  overlayToggle.checked = true;
  const overlayLabel = document.createElement('label');
  overlayLabel.className = 'overlay-toggle';
  overlayLabel.append(overlayToggle, 'Show landmarks');

  const overlay = document.createElement('canvas');
  overlay.className = 'landmark-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  const context = overlay.getContext('2d');

  function clearOverlay(): void {
    context?.clearRect(0, 0, overlay.width, overlay.height);
  }

  function drawOverlay(observation: TrackingObservation): void {
    clearOverlay();
    if (!context || !overlayToggle.checked || !observation.faceDetected) return;
    context.fillStyle = '#e8f487';
    for (const point of observation.landmarks) {
      context.beginPath();
      context.arc(
        point.x * overlay.width,
        point.y * overlay.height,
        1.4,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }

  function updateBlendshapes(observation: TrackingObservation): void {
    for (const shape of observation.blendshapes) {
      let value = blendshapeRows.get(shape.name);
      if (!value) {
        const row = document.createElement('tr');
        const name = document.createElement('th');
        name.scope = 'row';
        name.textContent = shape.name;
        value = document.createElement('td');
        row.append(name, value);
        blendshapeBody.append(row);
        blendshapeRows.set(shape.name, value);
      }
      value.textContent = shape.score.toFixed(3);
    }
  }

  function updateObservation(
    observation: TrackingObservation,
    metrics: TrackerMetrics,
  ): void {
    drawOverlay(observation);
    const now = performance.now();
    if (now - lastTextUpdateMs < 125) return;
    lastTextUpdateMs = now;

    faceField.value.textContent = observation.faceDetected
      ? 'Detected'
      : 'Not detected';
    confidenceField.value.textContent =
      observation.confidence === null
        ? 'Not exposed by this model'
        : observation.confidence.toFixed(3);
    fpsField.value.textContent = metrics.fps.toFixed(1);
    inferenceField.value.textContent = `${metrics.inferenceMs.toFixed(1)} ms`;
    const pose = observation.pose;
    yawField.value.textContent = pose ? formatAngle(pose.yaw) : '—';
    pitchField.value.textContent = pose ? formatAngle(pose.pitch) : '—';
    rollField.value.textContent = pose ? formatAngle(pose.roll) : '—';
    translationField.value.textContent = pose
      ? pose.translation.map((value) => value.toFixed(2)).join(', ')
      : '—';
    framingField.value.textContent = !observation.faceDetected
      ? 'Look toward the camera'
      : isFaceNearFrameEdge(observation.landmarks)
        ? 'Face near edge; move back to include hair'
        : 'Leave space around the full hair silhouette';
    matrix.textContent = pose
      ? Array.from({ length: 4 }, (_, row) =>
          pose.matrix
            .slice(row * 4, row * 4 + 4)
            .map((value) => value.toFixed(3))
            .join('  '),
        ).join('\n')
      : 'No face matrix yet';
    updateBlendshapes(observation);
  }

  function setTrackerStatus(status: TrackerStatus): void {
    statusField.value.textContent = status;
    pauseButton.disabled = status !== 'running' && status !== 'paused';
    pauseButton.textContent =
      status === 'paused' ? 'Resume tracking' : 'Pause tracking';
    if (status === 'idle') {
      faceField.value.textContent = '—';
      fpsField.value.textContent = '—';
      inferenceField.value.textContent = '—';
    }
  }

  const tracker = new FaceTracker(createMediaPipeDetector, {
    onStatus: setTrackerStatus,
    onObservation: updateObservation,
    onError: () => {
      trackerError.textContent =
        'Face tracking failed. Stop the camera and try again.';
      trackerError.hidden = false;
    },
  });
  setTrackerStatus('idle');
  const workspace = new CameraWorkspace(host, {
    title: 'Tracking lab',
    eyebrow: 'Development / M1',
    onReady(video) {
      trackerError.hidden = true;
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
      void tracker.start(video).catch(() => {
        // A user-facing message is set by the tracker error callback.
      });
    },
    onStopped() {
      tracker.stop();
      clearOverlay();
    },
  });
  workspace.main.classList.add('tracking-lab-layout');
  workspace.previewFrame.append(overlay);

  pauseButton.addEventListener('click', () => {
    if (pauseButton.textContent === 'Resume tracking') tracker.resume();
    else tracker.pause();
  });
  overlayToggle.addEventListener('change', () => {
    if (!overlayToggle.checked) clearOverlay();
  });

  const diagnostics = document.createElement('section');
  diagnostics.className = 'tracking-diagnostics';
  const heading = document.createElement('h2');
  heading.textContent = 'Local tracking diagnostics';
  const note = document.createElement('p');
  note.textContent =
    'Preview and overlay are mirrored for display. MediaPipe reads the original camera frame. Raw pose is not calibrated or mapped to an avatar. Calibration and smoothing belong to M9.';
  const controls = document.createElement('div');
  controls.className = 'lab-controls';
  controls.append(pauseButton, overlayLabel);
  const grid = document.createElement('div');
  grid.className = 'diagnostic-grid';
  for (const item of [
    statusField,
    faceField,
    confidenceField,
    fpsField,
    inferenceField,
    yawField,
    pitchField,
    rollField,
    translationField,
    framingField,
  ]) {
    grid.append(item.row);
  }
  const matrixHeading = document.createElement('h3');
  matrixHeading.textContent = 'Facial transformation matrix';
  const blendshapeHeading = document.createElement('h3');
  blendshapeHeading.textContent = 'Raw blendshape scores';
  const table = document.createElement('table');
  table.className = 'blendshape-table';
  const tableHead = document.createElement('thead');
  const headingRow = document.createElement('tr');
  for (const label of ['Blendshape', 'Score']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    headingRow.append(cell);
  }
  tableHead.append(headingRow);
  table.append(tableHead, blendshapeBody);
  diagnostics.append(
    heading,
    note,
    controls,
    trackerError,
    grid,
    matrixHeading,
    matrix,
    blendshapeHeading,
    table,
  );
  workspace.main.append(diagnostics);
}
