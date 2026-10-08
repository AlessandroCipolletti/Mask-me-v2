import { FalClient } from './FalClient';
import { browserEnvironment, type FalDiagnostic } from './FalDiagnostics';
import { normalizeProviderFailure } from './ProviderError';
import { VolatileCredential } from './VolatileCredential';
import { VerifiedKeyStorage } from './VerifiedKeyStorage';
import { FAL_ACCOUNT_URL } from './falAccount';
import './provider.css';

const SAVED_KEY_MASK = '************';

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** M3 key entry and explicit, non-billable provider probe. */
export function mountProviderWorkspace(
  root: HTMLElement,
  development: boolean,
): () => void {
  const credential = new VolatileCredential();
  const keyStorage = new VerifiedKeyStorage();
  let storedKey = keyStorage.restore(credential);
  let persistenceMessage = storedKey
    ? 'A previously checked key is saved in this browser.'
    : '';
  const diagnosticEvents: FalDiagnostic[] = [];
  let diagnosticOutput: HTMLPreElement | null = null;
  let diagnosticDetails: HTMLDetailsElement | null = null;
  const onDiagnostic = (event: FalDiagnostic) => {
    diagnosticEvents.push(event);
    if (diagnosticEvents.length > 24) diagnosticEvents.shift();
    if (diagnosticOutput)
      diagnosticOutput.textContent = diagnosticEvents
        .map((entry) => JSON.stringify(entry))
        .join('\n');
    // Every field is an allowlisted category, boolean or number. No URL query,
    // credential, request payload, response body or raw browser error is logged.
    console.info('[fal diagnostic]', event);
  };
  const client = new FalClient(credential, fetch, undefined, onDiagnostic);
  let controller: AbortController | null = null;
  let disposed = false;

  const main = element('main', 'provider-workspace');
  main.append(
    element(
      'p',
      'eyebrow',
      development ? 'Development / M3' : 'Connection / M3',
    ),
  );
  main.append(element('h1', undefined, 'Connect fal'));
  main.append(
    element(
      'p',
      'description',
      'Use your own fal API key. It is saved in this browser only after a successful connection check, and Clear key removes it. Live camera frames stay on your device. Character generation sends only the still image you choose.',
    ),
  );

  const label = element('label', 'provider-label', 'fal API key');
  label.htmlFor = 'fal-key';
  const input = element('input', 'provider-input');
  input.id = 'fal-key';
  input.type = 'password';
  input.autocomplete = 'off';
  input.autocapitalize = 'off';
  input.spellcheck = false;
  input.placeholder = 'Paste your key without the Key prefix';
  let inputMasked = false;
  function showSavedKeyMask(): void {
    if (!storedKey || !credential.ready) return;
    input.type = 'password';
    input.value = SAVED_KEY_MASK;
    inputMasked = true;
    reveal.textContent = 'Show';
  }
  const reveal = element('button', undefined, 'Show');
  reveal.type = 'button';
  reveal.setAttribute('aria-label', 'Show API key while entering');
  reveal.addEventListener('click', () => {
    if (inputMasked) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    reveal.textContent = input.type === 'password' ? 'Show' : 'Hide';
  });
  showSavedKeyMask();
  const entry = element('div', 'provider-entry');
  entry.append(input, reveal);
  const save = element('button', 'primary-button', 'Use key in this page');
  save.type = 'button';
  const clear = element('button', undefined, 'Clear key');
  clear.type = 'button';
  const check = element('button', undefined, 'Check connection');
  check.type = 'button';
  const createAccount = element('a', 'external-button', 'Create fal account');
  createAccount.href = FAL_ACCOUNT_URL;
  createAccount.target = '_blank';
  createAccount.rel = 'noopener noreferrer';
  createAccount.referrerPolicy = 'no-referrer';
  createAccount.setAttribute(
    'aria-label',
    'Create fal account (opens in a new tab)',
  );
  const actions = element('div', 'provider-actions');
  actions.append(save, clear, check, createAccount);
  const status = element('p', 'provider-status');
  status.setAttribute('role', 'status');
  const persistenceStatus = element('p', 'provider-detail');
  const detail = element('p', 'provider-detail');
  detail.textContent =
    'Check connection sends one read-only pricing request directly to fal after you click. It does not generate media or incur model charges.';
  main.append(label, entry, actions, status, persistenceStatus, detail);
  diagnosticDetails = element('details', 'provider-diagnostics');
  diagnosticDetails.append(
    element('summary', undefined, 'Connection diagnostics'),
  );
  diagnosticDetails.append(
    element(
      'p',
      'provider-detail',
      'Target: GET https://api.fal.ai/v1/models/pricing?endpoint_id=fal-ai%2Fflux%2Fdev. Open DevTools Console for the same safe events. In Network, select All and enable Preserve log. Browser CORS details may appear only in Console.',
    ),
  );
  diagnosticOutput = element(
    'pre',
    'provider-diagnostic-output',
    'No request yet.',
  );
  diagnosticDetails.append(diagnosticOutput);
  main.append(diagnosticDetails);
  if (development) {
    const note = element(
      'p',
      'provider-debug',
      'M3 transport check only. Generation inputs, prompts, images and model jobs begin in M4.',
    );
    main.append(note);
  }
  const back = element('a', 'provider-back', 'Back to camera');
  back.href = '/';
  main.append(back);
  root.replaceChildren(main);

  const render = (message?: string, isError = false) => {
    if (disposed) return;
    status.textContent =
      message ??
      (credential.ready
        ? 'Key ready for this page.'
        : 'No key in this browser.');
    status.classList.toggle('provider-error', isError);
    persistenceStatus.textContent = persistenceMessage;
    check.disabled = !credential.ready || controller !== null;
    clear.disabled = !credential.ready && !input.value;
    save.disabled = inputMasked || !input.value.trim();
    reveal.disabled = inputMasked;
  };

  save.addEventListener('click', () => {
    if (inputMasked || !input.value.trim()) return;
    controller?.abort();
    controller = null;
    const value = input.value;
    input.value = '';
    inputMasked = false;
    input.type = 'password';
    reveal.textContent = 'Show';
    try {
      credential.set(value);
      keyStorage.forget();
      storedKey = false;
      persistenceMessage = 'Check connection to save this key for refresh.';
      render('Key ready for this page.');
    } catch {
      showSavedKeyMask();
      render('Enter a valid fal API key.', true);
    }
  });
  input.addEventListener('focus', () => {
    if (!inputMasked) return;
    input.value = '';
    inputMasked = false;
    render();
  });
  input.addEventListener('blur', () => {
    if (!input.value) {
      showSavedKeyMask();
      render();
    }
  });
  input.addEventListener('input', () => {
    if (input.value !== SAVED_KEY_MASK) inputMasked = false;
    render();
  });
  clear.addEventListener('click', () => {
    controller?.abort();
    controller = null;
    credential.clear();
    keyStorage.forget();
    storedKey = false;
    persistenceMessage = 'Key cleared from this browser.';
    input.value = '';
    inputMasked = false;
    render('Key cleared.');
  });
  check.addEventListener('click', async () => {
    if (controller || !credential.ready) return;
    onDiagnostic({
      at: new Date().toISOString(),
      operation: 'pricing_check',
      step: 'check_clicked',
      ...browserEnvironment(),
    });
    controller = new AbortController();
    const active = controller;
    render('Checking fal connection…');
    try {
      const saved = await keyStorage.verifyAndRemember(
        credential,
        () => client.checkConnection(active.signal),
        active.signal,
      );
      if (!disposed && controller === active) {
        storedKey = saved;
        showSavedKeyMask();
        persistenceMessage = saved
          ? 'Validated key saved in this browser.'
          : 'Connected, but this browser could not save the key.';
        render('Connected to fal.');
      }
    } catch (error) {
      const failure = normalizeProviderFailure(error, active.signal);
      if (!disposed && controller === active) {
        if (failure.code === 'authentication') {
          keyStorage.forget();
          credential.clear();
          storedKey = false;
          input.value = '';
          inputMasked = false;
          persistenceMessage = 'This key was rejected. Enter a new key.';
        }
        render(failure.message, true);
        if (diagnosticDetails) diagnosticDetails.open = true;
      }
    } finally {
      if (controller === active) controller = null;
      if (!disposed) {
        check.disabled = !credential.ready || controller !== null;
      }
    }
  });

  function clearPageCredential() {
    controller?.abort();
    controller = null;
    credential.clear();
    input.value = '';
    inputMasked = false;
    input.type = 'password';
    reveal.textContent = 'Show';
    persistenceMessage = '';
    render('Key cleared from page memory.');
  }
  function dispose() {
    if (disposed) return;
    clearPageCredential();
    disposed = true;
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
  }
  function onPageHide() {
    clearPageCredential();
  }
  function onPageShow(event: PageTransitionEvent) {
    if (!event.persisted) return;
    storedKey = keyStorage.restore(credential);
    showSavedKeyMask();
    persistenceMessage = storedKey
      ? 'A previously checked key is saved in this browser.'
      : '';
    render();
  }
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  render();
  return dispose;
}
