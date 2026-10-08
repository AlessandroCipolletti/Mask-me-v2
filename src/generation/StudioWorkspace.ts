import { CameraService, normalizeCameraError } from '../camera/CameraService';
import {
  browserEnvironment,
  type FalDiagnostic,
} from '../provider/FalDiagnostics';
import { normalizeProviderFailure } from '../provider/ProviderError';
import { VolatileCredential } from '../provider/VolatileCredential';
import { VerifiedKeyStorage } from '../provider/VerifiedKeyStorage';
import { FAL_ACCOUNT_URL } from '../provider/falAccount';
import type { SourcePhoto } from './CharacterImageGenerator';
import {
  buildCanonicalPrompt,
  buildCanonicalSystemPrompt,
  CANONICAL_PROMPT_VERSION,
} from './canonicalPrompt';
import { createStudioServices } from './createStudioServices';
import {
  CANONICAL_MODEL_ID,
  LEGACY_CANONICAL_MODEL_ID,
} from './FalCanonicalImageGenerator';
import { PendingGenerationStore } from './PendingGenerationStore';
import { SourcePhotoStore } from './SourcePhotoStore';
import { ViewSetStore } from './ViewSetStore';
import { viewSetReady, type ViewSetState } from './ViewSetSession';
import { VIEW_IDS, VIEW_LABELS, type GeneratedViewId } from './viewPrompts';
import './studio.css';

const SAVED_KEY_MASK = '************';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label: string, primary = false): HTMLButtonElement {
  const node = el('button', primary ? 'primary-button' : undefined, label);
  node.type = 'button';
  return node;
}

export function mountStudioWorkspace(
  root: HTMLElement,
  debug = false,
): () => void {
  const showDebug = import.meta.env.MODE !== 'production' && debug;
  const credential = new VolatileCredential();
  const keyStorage = new VerifiedKeyStorage();
  const pendingStore = new PendingGenerationStore();
  const photoStore = new SourcePhotoStore();
  const viewStore = new ViewSetStore();
  const restoredViewSet = viewStore.read();
  let pendingRecord = pendingStore.read();
  const stalePhotoCleanup = pendingRecord
    ? Promise.resolve()
    : photoStore.clear();
  let storedKey = keyStorage.restore(credential);
  const diagnosticEvents: FalDiagnostic[] = [];
  const services = createStudioServices(
    credential,
    onSessionChanged,
    onViewChanged,
    (event) => {
      if (event.operation === 'pricing_check') {
        diagnosticEvents.push(event);
        if (diagnosticEvents.length > 24) diagnosticEvents.shift();
        updateConnectionDiagnostics();
      }
      console.info('[fal diagnostic]', event);
    },
  );
  const session = services.session;
  const views = services.views;
  const camera = new CameraService(() => {
    cameraMessage = 'Camera stopped. Enable it again to take a photo.';
    render();
  });
  let previewUrl: string | null = null;
  let sourceNumber = 0;
  let cameraMessage = '';
  let keyMessage = storedKey
    ? 'A previously checked key is saved in this browser.'
    : '';
  let checkMessage = '';
  let checkError = false;
  let checkController: AbortController | null = null;
  let recoveryController: AbortController | null = null;
  let starting = false;
  let disposed = false;
  let cameraRevision = 0;
  let resuming = false;
  let resumeRequested = false;
  let preparingGeneration = false;
  let viewSectionOpen = false;

  function onSessionChanged(
    state: import('./CanonicalSession').CanonicalSessionState,
  ): void {
    if (
      state.requestId &&
      state.source &&
      pendingRecord?.requestId !== state.requestId
    ) {
      pendingRecord = {
        requestId: state.requestId,
        metadata: services.metadataFor(state.source.id, state.requestId),
      };
      pendingStore.write(pendingRecord);
    } else if (!state.requestId) {
      pendingRecord = null;
      pendingStore.clear();
    }
    render();
  }

  function onViewChanged(state: ViewSetState): void {
    viewStore.write(state);
    render();
  }

  const main = el('main', 'studio-workspace');
  main.append(
    el(
      'p',
      'eyebrow',
      showDebug ? 'Development / generation' : 'Avatar studio',
    ),
  );
  main.append(el('h1', undefined, 'Create your character'));
  const intro = el(
    'p',
    'description',
    'Start with a clear photo of your complete head. The character is generated from this one image.',
  );
  main.append(intro);

  const keySection = el('section', 'studio-key');
  const keyHeading = el('h2', undefined, 'Your fal key');
  const keyDetail = el(
    'p',
    'studio-small',
    'Your key is saved in this browser only after a successful connection check. Clear key removes it. Character and view generation send selected images to fal and may incur charges. The photo is kept locally while a request may need refresh recovery. Live camera video stays on your device.',
  );
  const keyLabel = el('label', 'studio-label', 'fal API key');
  keyLabel.htmlFor = 'studio-key-input';
  const keyInput = el('input', 'studio-input');
  keyInput.id = 'studio-key-input';
  keyInput.type = 'password';
  keyInput.autocomplete = 'off';
  keyInput.autocapitalize = 'off';
  keyInput.spellcheck = false;
  let keyInputMasked = false;
  function showSavedKeyMask(): void {
    if (!storedKey || !credential.ready) return;
    keyInput.type = 'password';
    keyInput.value = SAVED_KEY_MASK;
    keyInputMasked = true;
  }
  showSavedKeyMask();
  const saveKey = button('Use key');
  const clearKey = button('Clear key');
  const checkKey = button('Check connection');
  const createAccount = el('a', 'external-button', 'Create fal account');
  createAccount.href = FAL_ACCOUNT_URL;
  createAccount.target = '_blank';
  createAccount.rel = 'noopener noreferrer';
  createAccount.referrerPolicy = 'no-referrer';
  createAccount.setAttribute(
    'aria-label',
    'Create fal account (opens in a new tab)',
  );
  const keyRow = el('div', 'studio-actions');
  keyRow.append(keyInput, saveKey, clearKey, checkKey, createAccount);
  const keyStatus = el('p', 'studio-small');
  const connectionStatus = el('p', 'studio-small');
  connectionStatus.setAttribute('role', 'status');
  const connectionDetails = el('details', 'studio-connection-diagnostics');
  connectionDetails.append(el('summary', undefined, 'Connection diagnostics'));
  connectionDetails.append(
    el(
      'p',
      'studio-small',
      'This is a read-only pricing check. It does not generate an image or incur a model charge. In DevTools Network, select All and enable Preserve log.',
    ),
  );
  const connectionOutput = el('pre', 'studio-diagnostics', 'No check yet.');
  connectionDetails.append(connectionOutput);
  keySection.append(
    keyHeading,
    keyDetail,
    keyLabel,
    keyRow,
    keyStatus,
    connectionStatus,
    connectionDetails,
  );
  main.append(keySection);

  const stage = el('section', 'studio-stage');
  const stageTitle = el('h2');
  const stageHint = el('p', 'studio-small');
  const frame = el('div', 'studio-frame');
  const video = el('video', 'studio-video');
  video.playsInline = true;
  video.muted = true;
  video.autoplay = true;
  const photo = el('img', 'studio-image');
  photo.alt = 'Captured photo, in the original camera orientation';
  const character = el('img', 'studio-image');
  character.alt = 'Generated canonical character';
  const emptyFrame = el(
    'p',
    'studio-frame-message',
    'Checking the existing fal request…',
  );
  frame.append(video, photo, character, emptyFrame);
  const actions = el('div', 'studio-actions');
  const enable = button('Enable camera', true);
  const take = button('Take photo', true);
  const stop = button('Stop camera');
  const create = button('Create character', true);
  const retake = button('Return to camera');
  const cancel = button('Cancel generation');
  const retryRecovery = button('Resume existing request');
  const forgetRecovery = button('Forget saved request');
  const regenerate = button('Regenerate character');
  const continueToViews = button('Continue to views', true);
  const back = button('Back to photo');
  actions.append(
    enable,
    take,
    stop,
    create,
    retake,
    cancel,
    retryRecovery,
    forgetRecovery,
    regenerate,
    continueToViews,
    back,
  );
  const status = el('p', 'studio-status');
  status.setAttribute('role', 'status');
  const error = el('p', 'studio-error');
  error.setAttribute('role', 'alert');
  stage.append(stageTitle, stageHint, frame, actions, status, error);
  main.append(stage);

  const viewStage = el('section', 'studio-stage studio-views');
  const viewTitle = el('h2', undefined, 'Review all angles');
  const viewHint = el(
    'p',
    'studio-small',
    'The front image is the reference for every new angle. Review identity, hair, ears, profile and rear silhouette before accepting each view.',
  );
  const viewSheet = el('div', 'studio-contact-sheet');
  const frontCard = el('figure', 'studio-view-item');
  const frontImage = el('img', 'studio-view-image');
  frontImage.alt = 'Canonical front view';
  let frontLoaded = false;
  let frontImageFailed = false;
  frontImage.addEventListener('load', () => {
    frontLoaded = frontImage.naturalWidth > 0;
    frontImageFailed = false;
    render();
  });
  frontImage.addEventListener('error', () => {
    frontLoaded = false;
    frontImageFailed = true;
    render();
  });
  frontCard.append(
    frontImage,
    el('figcaption', undefined, 'Front · canonical'),
  );
  viewSheet.append(frontCard);
  const viewCards = {} as Record<
    GeneratedViewId,
    {
      image: HTMLImageElement;
      placeholder: HTMLParagraphElement;
      status: HTMLParagraphElement;
      quality: HTMLParagraphElement;
      accept: HTMLButtonElement;
      flag: HTMLButtonElement;
      retry: HTMLButtonElement;
      forget: HTMLButtonElement;
      debug: HTMLPreElement;
    }
  >;
  for (const view of VIEW_IDS) {
    const item = el('figure', 'studio-view-item');
    const image = el('img', 'studio-view-image');
    image.alt = VIEW_LABELS[view];
    const placeholder = el('p', 'studio-view-placeholder', 'Awaiting image');
    const caption = el('figcaption', undefined, VIEW_LABELS[view]);
    const viewStatus = el('p', 'studio-small');
    const quality = el('p', 'studio-small');
    const controls = el('div', 'studio-actions');
    const accept = button('Accept view');
    const flag = button('Needs retry');
    const retry = button('Generate view');
    const forget = button('Forget request');
    controls.append(accept, flag, retry, forget);
    const debug = el('pre', 'studio-diagnostics');
    if (!showDebug) debug.hidden = true;
    item.append(
      image,
      placeholder,
      caption,
      viewStatus,
      quality,
      controls,
      debug,
    );
    viewSheet.append(item);
    viewCards[view] = {
      image,
      placeholder,
      status: viewStatus,
      quality,
      accept,
      flag,
      retry,
      forget,
      debug,
    };
    image.addEventListener('load', () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0)
        views.reportDimensions(view, image.naturalWidth, image.naturalHeight);
    });
    image.addEventListener('error', () => views.reportUnavailable(view));
    accept.addEventListener('click', () => views.review(view, 'accepted'));
    flag.addEventListener('click', () => views.review(view, 'flagged'));
    retry.addEventListener('click', () => {
      if (credential.ready) void views.retry(view);
    });
    forget.addEventListener('click', () => views.forgetPending(view));
  }
  const viewActions = el('div', 'studio-actions');
  const generateViews = button('Generate five views', true);
  const resumeViews = button('Resume existing views');
  const pauseViews = button('Pause checking');
  const backToCharacter = button('Back to character');
  const newCharacter = button('Start a new character');
  viewActions.append(
    generateViews,
    resumeViews,
    pauseViews,
    backToCharacter,
    newCharacter,
  );
  const viewSummary = el('p', 'studio-status');
  viewSummary.setAttribute('role', 'status');
  viewStage.append(viewTitle, viewHint, viewSheet, viewActions, viewSummary);
  main.append(viewStage);

  let upload: HTMLInputElement | null = null;
  let diagnostics: HTMLPreElement | null = null;
  let recoveryInput: HTMLInputElement | null = null;
  let recoveryModel: HTMLSelectElement | null = null;
  let recoveryButton: HTMLButtonElement | null = null;
  let recoveryStatus: HTMLParagraphElement | null = null;
  let recoveredImage: HTMLImageElement | null = null;
  let canonicalFixtureInput: HTMLInputElement | null = null;
  let canonicalFixtureButton: HTMLButtonElement | null = null;
  let canonicalFixtureStatus: HTMLParagraphElement | null = null;
  if (showDebug) {
    const tools = el('section', 'studio-dev');
    tools.append(el('h2', undefined, 'Generation lab'));
    tools.append(
      el(
        'p',
        'studio-small',
        'Upload an image to exercise M4 without camera, or use an existing canonical URL for M5. Model requests occur only after you click a generation button.',
      ),
    );
    upload = el('input');
    upload.type = 'file';
    upload.accept = 'image/jpeg,image/png,image/webp';
    const details = el('details');
    details.append(el('summary', undefined, 'Prompt, source and metadata'));
    diagnostics = el('pre', 'studio-diagnostics');
    details.append(diagnostics);
    tools.append(upload, details);
    const fixture = el('details', 'studio-recovery');
    fixture.append(el('summary', undefined, 'Use an existing canonical image'));
    fixture.append(
      el(
        'p',
        'studio-small',
        'Paste a public HTTPS image URL to inspect M5 without creating a new M4 image. View generation still makes paid requests only after you click a Generate button.',
      ),
    );
    const fixtureLabel = el('label', 'studio-label', 'Canonical image URL');
    fixtureLabel.htmlFor = 'studio-canonical-url';
    canonicalFixtureInput = el('input', 'studio-input');
    canonicalFixtureInput.id = 'studio-canonical-url';
    canonicalFixtureInput.type = 'url';
    canonicalFixtureInput.autocomplete = 'off';
    canonicalFixtureButton = button('Use image as canonical');
    canonicalFixtureStatus = el('p', 'studio-status');
    fixture.append(
      fixtureLabel,
      canonicalFixtureInput,
      canonicalFixtureButton,
      canonicalFixtureStatus,
    );
    tools.append(fixture);
    const recovery = el('details', 'studio-recovery');
    recovery.append(
      el('summary', undefined, 'Recover an existing fal request'),
    );
    recovery.append(
      el(
        'p',
        'studio-small',
        'Paste a Nano Banana edit request ID and select the model that created it. This only reads the existing job.',
      ),
    );
    const recoveryLabel = el('label', 'studio-label', 'fal request ID');
    recoveryLabel.htmlFor = 'studio-recovery-id';
    recoveryInput = el('input', 'studio-input');
    recoveryInput.id = 'studio-recovery-id';
    recoveryInput.autocomplete = 'off';
    recoveryInput.spellcheck = false;
    const recoveryModelLabel = el('label', 'studio-label', 'fal model');
    recoveryModelLabel.htmlFor = 'studio-recovery-model';
    recoveryModel = el('select', 'studio-input');
    recoveryModel.id = 'studio-recovery-model';
    for (const [label, id] of [
      ['Nano Banana 2.1', CANONICAL_MODEL_ID],
      ['Nano Banana 2 (earlier jobs)', LEGACY_CANONICAL_MODEL_ID],
    ] as const) {
      const option = el('option', undefined, label);
      option.value = id;
      recoveryModel.append(option);
    }
    recoveryButton = button('Recover existing image');
    recoveryStatus = el('p', 'studio-status');
    recoveryStatus.setAttribute('role', 'status');
    recoveredImage = el('img', 'studio-recovered-image');
    recoveredImage.alt = 'Image recovered from an existing fal request';
    recoveredImage.hidden = true;
    recovery.append(
      recoveryLabel,
      recoveryInput,
      recoveryModelLabel,
      recoveryModel,
      recoveryButton,
      recoveryStatus,
      recoveredImage,
    );
    tools.append(recovery);
    main.append(tools);
  }
  if (showDebug) {
    const connection = el('a', 'studio-link', 'Provider connection check');
    connection.href = '/provider';
    main.append(connection);
  }
  root.replaceChildren(main);

  function setPreview(source: SourcePhoto | null): void {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = source ? URL.createObjectURL(source.blob) : null;
    photo.removeAttribute('src');
    if (previewUrl) photo.src = previewUrl;
  }

  function updateConnectionDiagnostics(): void {
    connectionOutput.textContent = diagnosticEvents.length
      ? diagnosticEvents.map((event) => JSON.stringify(event)).join('\n')
      : 'No check yet.';
  }

  function abortCheck(): void {
    checkController?.abort();
    checkController = null;
  }

  function render(): void {
    if (disposed) return;
    const state = session.state;
    const viewState = views.state;
    stage.hidden = viewSectionOpen;
    viewStage.hidden = !viewSectionOpen;
    const step = state.step;
    const isCamera = step === 'camera';
    const isReview = step === 'photoReview';
    const isGenerating = step === 'generating';
    const isCharacter = step === 'characterReview';
    stageTitle.textContent =
      pendingRecord && !isGenerating
        ? 'Creating your character'
        : isCamera
          ? '1. Take a photo'
          : isReview
            ? '2. Review your photo'
            : isGenerating
              ? 'Creating your character'
              : '3. Review your character';
    stageHint.textContent =
      pendingRecord && !isGenerating
        ? 'The fal request was submitted. Resume checking it without creating another image.'
        : isCamera
          ? 'Face forward with a relaxed expression. Include all your hair, both ears where visible, and a little neck.'
          : isReview
            ? 'This unmirrored, full-resolution capture is the image that will be sent when you choose Create character.'
            : isGenerating
              ? 'Your selected still photo is being processed by fal. You can cancel local waiting.'
              : 'Check identity, complete hair and head, ears, expression, and clean framing.';
    video.hidden = !isCamera || !!pendingRecord;
    photo.hidden =
      !state.source || !(isReview || (isGenerating && !state.result));
    character.hidden = !(isCharacter || (isGenerating && !!state.result));
    emptyFrame.hidden = !!state.source || (!isGenerating && !pendingRecord);
    emptyFrame.textContent = isGenerating
      ? 'Checking the existing fal request…'
      : 'A character request is in progress. Enter your fal key to resume.';
    if (state.result && character.src !== state.result.image.url)
      character.src = state.result.image.url;
    if (!state.result) character.removeAttribute('src');
    enable.hidden = !isCamera || camera.active || !!pendingRecord;
    enable.disabled = starting;
    take.hidden = !isCamera || !camera.active;
    take.disabled = starting;
    stop.hidden = !isCamera || !camera.active;
    create.hidden = !isReview || !!pendingRecord;
    create.disabled = !credential.ready || preparingGeneration;
    retake.hidden = !isReview && !(isCharacter && !state.source);
    cancel.hidden = !isGenerating;
    cancel.textContent = resuming ? 'Stop checking' : 'Cancel generation';
    retryRecovery.hidden = !pendingRecord || isGenerating;
    retryRecovery.disabled = !credential.ready || resuming;
    forgetRecovery.hidden = !pendingRecord || isGenerating;
    regenerate.hidden = !isCharacter;
    regenerate.disabled =
      !credential.ready || !state.source || preparingGeneration;
    back.hidden = !isCharacter || !state.source;
    continueToViews.hidden = !isCharacter;
    status.textContent = isGenerating
      ? {
          submitting: 'Submitting to fal…',
          queued: 'Queued at fal…',
          running: 'Generating image…',
          retrieving: 'Retrieving image…',
        }[state.phase ?? 'submitting']
      : pendingRecord
        ? credential.ready
          ? 'The existing request is paused. Resume it to check the result.'
          : 'Enter your fal key to resume the existing request.'
        : isCamera
          ? cameraMessage
          : isReview && !credential.ready
            ? 'Enter your fal key to create this character.'
            : '';
    error.textContent = state.error ?? '';
    keyStatus.textContent =
      keyMessage ||
      (credential.ready
        ? 'Key ready. Check connection to save it for refresh.'
        : 'No key saved in this browser.');
    clearKey.disabled = !credential.ready && !keyInput.value;
    saveKey.disabled = keyInputMasked || !keyInput.value.trim();
    checkKey.disabled = !credential.ready || checkController !== null;
    connectionStatus.textContent = checkMessage;
    connectionStatus.classList.toggle('studio-error', checkError);
    if (diagnostics)
      diagnostics.textContent = JSON.stringify(
        {
          source: state.source
            ? {
                id: state.source.id,
                width: state.source.width,
                height: state.source.height,
                contentType: state.source.blob.type,
                bytes: state.source.blob.size,
              }
            : null,
          promptVersion:
            state.result?.metadata.promptVersion ?? CANONICAL_PROMPT_VERSION,
          finalPrompt:
            state.result?.metadata.finalPrompt ?? buildCanonicalPrompt(),
          systemPrompt:
            state.result?.metadata.parameters['system_prompt'] ??
            buildCanonicalSystemPrompt(),
          phase: state.phase,
          result: state.result?.image ?? null,
          metadata: state.result?.metadata ?? null,
          error: state.error,
          viewSet: viewState,
        },
        null,
        2,
      );

    if (viewSectionOpen && viewState.reference) {
      if (frontImage.src !== viewState.reference.image.url) {
        frontLoaded = false;
        frontImageFailed = false;
        frontImage.src = viewState.reference.image.url;
      }
      const entries = VIEW_IDS.map((view) => viewState.views[view]);
      const completed = entries.filter(
        (entry) => entry.status === 'ready',
      ).length;
      const pending = entries.some((entry) => !!entry.pendingMetadata);
      const missing = entries.some(
        (entry) =>
          (entry.status === 'empty' || entry.status === 'failed') &&
          !entry.pendingMetadata,
      );
      generateViews.hidden = !missing;
      generateViews.textContent =
        completed === 0 ? 'Generate five views' : 'Generate remaining views';
      generateViews.disabled =
        !credential.ready || viewState.batchRunning || !frontLoaded;
      resumeViews.hidden = !pending || viewState.batchRunning;
      resumeViews.disabled = !credential.ready;
      pauseViews.hidden = !viewState.batchRunning;
      backToCharacter.disabled = viewState.batchRunning;
      viewSummary.textContent = !frontLoaded
        ? frontImageFailed
          ? 'The canonical image could not be displayed. Check its URL or start a new character.'
          : 'Loading the canonical image. View generation is available when it appears.'
        : viewSetReady(viewState)
          ? 'All six views reviewed. The set is ready for 3D reconstruction in the next milestone.'
          : `${completed} of 5 additional views generated. Review and accept each image. ${viewState.batchRunning ? 'Checking fal jobs…' : ''}`;
      for (const view of VIEW_IDS) {
        const entry = viewState.views[view];
        const card = viewCards[view];
        const url = entry.result?.image.url;
        if (url && card.image.src !== url) card.image.src = url;
        if (!url && card.image.hasAttribute('src'))
          card.image.removeAttribute('src');
        card.image.hidden = !url;
        card.placeholder.hidden = !!url;
        card.status.textContent =
          entry.status === 'generating'
            ? `${entry.phase ?? 'submitting'} at fal…`
            : entry.status === 'paused'
              ? 'Existing request paused; resume without another charge.'
              : entry.status === 'ready'
                ? entry.review === 'accepted'
                  ? 'Accepted'
                  : entry.review === 'flagged'
                    ? 'Marked for retry'
                    : 'Awaiting your review'
                : entry.status === 'failed'
                  ? (entry.error ?? 'Generation failed. Other views were kept.')
                  : entry.status === 'waiting'
                    ? 'Waiting for a free generation slot…'
                    : 'Not generated';
        card.quality.textContent = entry.qualityReasons.length
          ? `Check: ${entry.qualityReasons.join(', ').replaceAll('_', ' ')}`
          : '';
        card.accept.hidden =
          !entry.result ||
          entry.status !== 'ready' ||
          entry.review === 'accepted';
        card.accept.disabled = entry.qualityReasons.some(
          (reason) => reason !== 'dimensions_unverified',
        );
        card.flag.hidden =
          !entry.result ||
          entry.status !== 'ready' ||
          entry.review === 'flagged';
        card.retry.hidden =
          entry.status === 'generating' ||
          entry.status === 'waiting' ||
          !!entry.pendingMetadata;
        card.retry.disabled =
          !credential.ready || viewState.batchRunning || !frontLoaded;
        card.retry.textContent = entry.result
          ? 'Regenerate view'
          : 'Generate view';
        card.forget.hidden =
          !entry.pendingMetadata || entry.status === 'generating';
        card.forget.disabled = viewState.batchRunning;
        if (showDebug)
          card.debug.textContent = JSON.stringify(
            {
              view,
              metadata: entry.result?.metadata ?? entry.pendingMetadata,
              qualityReasons: entry.qualityReasons,
              error: entry.error,
            },
            null,
            2,
          );
      }
    }
  }

  async function resumePending(): Promise<void> {
    if (resuming || !credential.ready || !pendingRecord || disposed) return;
    resuming = true;
    const record = pendingRecord;
    try {
      const source = await photoStore.read(record.metadata.sourcePhotoId);
      if (disposed || pendingRecord?.requestId !== record.requestId) return;
      setPreview(source);
      await session.recover(record.requestId, source, record.metadata);
    } finally {
      resuming = false;
      render();
      if (resumeRequested) {
        resumeRequested = false;
        void resumePending();
      }
    }
  }

  async function startCamera(): Promise<void> {
    if (starting || camera.active) return;
    starting = true;
    const revision = ++cameraRevision;
    cameraMessage = 'Opening camera…';
    render();
    try {
      await camera.start(video);
      if (revision !== cameraRevision || disposed) {
        camera.stop();
        return;
      }
      cameraMessage = 'Camera ready. Take one clear photo.';
    } catch (failure) {
      if (revision === cameraRevision)
        cameraMessage = normalizeCameraError(failure).message;
    } finally {
      if (revision === cameraRevision) {
        starting = false;
        render();
      }
    }
  }

  function stopCamera(): void {
    ++cameraRevision;
    starting = false;
    camera.stop();
    cameraMessage = 'Camera stopped.';
    render();
  }

  saveKey.addEventListener('click', () => {
    if (keyInputMasked || !keyInput.value.trim()) return;
    abortCheck();
    try {
      credential.set(keyInput.value);
      session.cancel(pendingRecord ? 'pause' : undefined);
      views.pause();
      keyStorage.forget();
      storedKey = false;
      keyMessage = 'Key ready. Check connection to save it for refresh.';
      checkMessage = '';
      if (resuming) resumeRequested = true;
      else void resumePending();
      void views.resumePending();
    } catch {
      keyMessage = 'Enter a valid fal API key.';
    }
    keyInput.value = '';
    keyInputMasked = false;
    showSavedKeyMask();
    render();
  });
  keyInput.addEventListener('focus', () => {
    if (!keyInputMasked) return;
    keyInput.value = '';
    keyInputMasked = false;
    render();
  });
  keyInput.addEventListener('blur', () => {
    if (!keyInput.value) {
      showSavedKeyMask();
      render();
    }
  });
  keyInput.addEventListener('input', () => {
    if (keyInput.value !== SAVED_KEY_MASK) keyInputMasked = false;
    keyMessage = '';
    render();
  });
  clearKey.addEventListener('click', () => {
    abortCheck();
    session.cancel();
    views.pause();
    credential.clear();
    pendingRecord = null;
    pendingStore.clear();
    void photoStore.clear();
    keyStorage.forget();
    storedKey = false;
    keyInput.value = '';
    keyInputMasked = false;
    keyMessage = 'Key cleared from this browser.';
    checkMessage = '';
    render();
  });
  checkKey.addEventListener('click', async () => {
    if (checkController || !credential.ready) return;
    diagnosticEvents.length = 0;
    const active = new AbortController();
    checkController = active;
    diagnosticEvents.push({
      at: new Date().toISOString(),
      operation: 'pricing_check',
      step: 'check_clicked',
      ...browserEnvironment(),
    });
    updateConnectionDiagnostics();
    checkMessage = 'Checking fal connection…';
    checkError = false;
    render();
    try {
      const saved = await keyStorage.verifyAndRemember(
        credential,
        () => services.checkConnection(active.signal),
        active.signal,
      );
      if (checkController === active && !disposed) {
        storedKey = saved;
        showSavedKeyMask();
        keyMessage = saved
          ? 'Validated key saved in this browser.'
          : 'Connected, but this browser could not save the key.';
        checkMessage = 'Connected to fal.';
      }
    } catch (failure) {
      if (checkController === active && !disposed) {
        const error = normalizeProviderFailure(failure, active.signal);
        if (error.code === 'authentication') {
          keyStorage.forget();
          credential.clear();
          storedKey = false;
          keyInput.value = '';
          keyInputMasked = false;
          keyMessage = 'This key was rejected. Enter a new key.';
        }
        checkMessage = error.message;
        checkError = true;
        connectionDetails.open = true;
      }
    } finally {
      if (checkController === active) checkController = null;
      render();
    }
  });
  enable.addEventListener('click', () => {
    void startCamera();
  });
  stop.addEventListener('click', stopCamera);
  take.addEventListener('click', async () => {
    if (!camera.active) return;
    take.disabled = true;
    const revision = cameraRevision;
    try {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const blob = await camera.capture();
      if (disposed || revision !== cameraRevision) return;
      const source: SourcePhoto = {
        id: `capture-${++sourceNumber}`,
        blob,
        width,
        height,
      };
      stopCamera();
      setPreview(source);
      session.review(source);
    } catch (failure) {
      if (revision === cameraRevision) {
        cameraMessage = normalizeCameraError(failure).message;
        render();
      }
    } finally {
      take.disabled = false;
    }
  });
  create.addEventListener('click', () => {
    void generateWithSavedSource();
  });
  regenerate.addEventListener('click', () => {
    void generateWithSavedSource();
  });
  async function generateWithSavedSource(): Promise<void> {
    const source = session.state.source;
    if (!source || preparingGeneration) return;
    if (views.state.reference) views.clear();
    preparingGeneration = true;
    render();
    try {
      await stalePhotoCleanup;
      await photoStore.save(source);
      if (!disposed && session.state.source === source)
        await session.generate();
    } finally {
      preparingGeneration = false;
      render();
    }
  }
  cancel.addEventListener('click', () =>
    session.cancel(resuming ? 'pause' : undefined),
  );
  retryRecovery.addEventListener('click', () => {
    void resumePending();
  });
  forgetRecovery.addEventListener('click', () => {
    session.retake();
    pendingRecord = null;
    pendingStore.clear();
    setPreview(null);
    void photoStore.clear();
    render();
  });
  back.addEventListener('click', () => session.backToPhoto());
  retake.addEventListener('click', () => {
    views.clear();
    session.retake();
    setPreview(null);
    void photoStore.clear();
    void startCamera();
  });
  continueToViews.addEventListener('click', () => {
    const result = session.state.result;
    if (!result) return;
    viewSectionOpen = true;
    views.start(result);
    render();
  });
  generateViews.addEventListener('click', () => {
    if (credential.ready) void views.generateMissing();
  });
  resumeViews.addEventListener('click', () => {
    if (credential.ready) void views.resumePending();
  });
  pauseViews.addEventListener('click', () => views.pause());
  backToCharacter.addEventListener('click', () => {
    viewSectionOpen = false;
    render();
  });
  newCharacter.addEventListener('click', () => {
    views.clear();
    viewSectionOpen = false;
    session.retake();
    setPreview(null);
    void photoStore.clear();
    void startCamera();
  });
  character.addEventListener('error', () => {
    if (session.state.result) {
      status.textContent =
        'The image URL could not be displayed. Regenerate or check your connection.';
    }
  });
  upload?.addEventListener('change', async () => {
    const file = upload?.files?.[0];
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 12_000_000 ||
      file.size === 0
    ) {
      cameraMessage = 'Choose a JPEG, PNG or WebP under 12 MB.';
      render();
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const dimensions = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          const image = new Image();
          image.onload = () =>
            resolve({ width: image.naturalWidth, height: image.naturalHeight });
          image.onerror = reject;
          image.src = url;
        },
      );
      stopCamera();
      const source: SourcePhoto = {
        id: `upload-${++sourceNumber}`,
        blob: file,
        ...dimensions,
      };
      setPreview(source);
      session.review(source);
    } catch {
      cameraMessage = 'Could not read this image.';
      render();
    } finally {
      URL.revokeObjectURL(url);
      if (upload) upload.value = '';
    }
  });

  recoveryButton?.addEventListener('click', async () => {
    if (
      recoveryController ||
      !recoveryInput ||
      !recoveryModel ||
      !recoveryStatus ||
      !recoveredImage
    )
      return;
    if (!credential.ready) {
      recoveryStatus.textContent = 'Enter or restore your fal key first.';
      return;
    }
    const requestId = recoveryInput.value.trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(requestId)) {
      recoveryStatus.textContent = 'Enter a valid fal request ID.';
      return;
    }
    const active = new AbortController();
    recoveryController = active;
    recoveryButton.disabled = true;
    recoveredImage.hidden = true;
    recoveryStatus.textContent = 'Reading the existing fal request…';
    try {
      const image = await services.recoverExisting(
        requestId,
        active.signal,
        recoveryModel.value,
      );
      if (recoveryController === active && !disposed) {
        recoveredImage.src = image.url;
        recoveredImage.hidden = false;
        recoveryStatus.textContent = 'Existing image recovered.';
      }
    } catch (failure) {
      if (recoveryController === active && !disposed)
        recoveryStatus.textContent = normalizeProviderFailure(
          failure,
          active.signal,
        ).message;
    } finally {
      if (recoveryController === active) recoveryController = null;
      if (!disposed) recoveryButton.disabled = false;
    }
  });
  recoveredImage?.addEventListener('error', () => {
    if (recoveryStatus)
      recoveryStatus.textContent =
        'The recovered image URL could not be displayed.';
  });
  canonicalFixtureButton?.addEventListener('click', () => {
    if (!canonicalFixtureInput || !canonicalFixtureStatus) return;
    let url: URL;
    try {
      url = new URL(canonicalFixtureInput.value.trim());
    } catch {
      canonicalFixtureStatus.textContent = 'Enter a valid HTTPS image URL.';
      return;
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
      canonicalFixtureStatus.textContent = 'Enter a public HTTPS image URL.';
      return;
    }
    const reference = {
      image: { url: url.href, contentType: 'image/png' },
      metadata: {
        provider: 'fal',
        modelId: CANONICAL_MODEL_ID,
        promptVersion: 'development-fixture-v1',
        finalPrompt:
          'Existing canonical image URL supplied in the development lab.',
        parameters: {},
        sourcePhotoId: 'development-fixture',
        timestamp: new Date().toISOString(),
        providerRequestId: `fixture_${Date.now()}`,
      },
    };
    views.clear();
    session.restore(reference);
    viewSectionOpen = true;
    views.start(reference);
    canonicalFixtureStatus.textContent =
      'Canonical image loaded as the M5 reference.';
    render();
  });

  function clearPage(): void {
    abortCheck();
    recoveryController?.abort();
    recoveryController = null;
    recoveredImage?.removeAttribute('src');
    if (recoveredImage) recoveredImage.hidden = true;
    if (recoveryInput) recoveryInput.value = '';
    if (recoveryStatus) recoveryStatus.textContent = '';
    session.cancel('pagehide');
    views.pause();
    if (!pendingRecord) {
      session.retake();
      void photoStore.clear();
    }
    stopCamera();
    setPreview(null);
    credential.clear();
    keyInput.value = '';
    keyInputMasked = false;
    keyMessage = '';
    checkMessage = '';
    render();
  }
  function onPageHide(): void {
    clearPage();
  }
  function onPageShow(event: PageTransitionEvent): void {
    if (!event.persisted) return;
    storedKey = keyStorage.restore(credential);
    showSavedKeyMask();
    keyMessage = storedKey
      ? 'A previously checked key is saved in this browser.'
      : '';
    if (views.state.reference && !session.state.result)
      session.restore(views.state.reference);
    render();
    void resumePending();
    if (credential.ready) void views.resumePending();
  }
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  if (restoredViewSet && !pendingRecord) {
    session.restore(restoredViewSet.reference!);
    viewSectionOpen = true;
    views.restore(restoredViewSet);
  } else if (restoredViewSet) viewStore.clear();
  render();
  void resumePending();
  if (credential.ready) void views.resumePending();
  return () => {
    if (disposed) return;
    clearPage();
    disposed = true;
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
  };
}
