import { FalClient } from './FalClient';
import { browserEnvironment, type FalDiagnostic } from './FalDiagnostics';
import { normalizeProviderFailure } from './ProviderError';
import { VolatileCredential } from './VolatileCredential';
import './provider.css';

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
  const client = new FalClient(credential, fetch, 1_500, onDiagnostic);
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
      'Use your own fal API key. It stays in this page memory and is cleared when you leave or reload. Live camera frames stay on your device. Later generation requests will send only the still images you choose.',
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
  const reveal = element('button', undefined, 'Show');
  reveal.type = 'button';
  reveal.setAttribute('aria-label', 'Show API key while entering');
  reveal.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
    reveal.textContent = input.type === 'password' ? 'Show' : 'Hide';
  });
  const entry = element('div', 'provider-entry');
  entry.append(input, reveal);
  const save = element('button', 'primary-button', 'Use key in this page');
  save.type = 'button';
  const clear = element('button', undefined, 'Clear key');
  clear.type = 'button';
  const check = element('button', undefined, 'Check connection');
  check.type = 'button';
  const cancel = element('button', undefined, 'Cancel check');
  cancel.type = 'button';
  const actions = element('div', 'provider-actions');
  actions.append(save, clear, check, cancel);
  const status = element('p', 'provider-status');
  status.setAttribute('role', 'status');
  const detail = element('p', 'provider-detail');
  detail.textContent =
    'Check connection sends one read-only pricing request directly to fal after you click. It does not generate media or incur model charges.';
  main.append(label, entry, actions, status, detail);
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
        ? 'Key ready in page memory.'
        : 'No key in page memory.');
    status.classList.toggle('provider-error', isError);
    check.disabled = !credential.ready || controller !== null;
    clear.disabled = !credential.ready && !input.value;
    cancel.hidden = controller === null;
  };

  save.addEventListener('click', () => {
    const value = input.value;
    input.value = '';
    input.type = 'password';
    reveal.textContent = 'Show';
    try {
      credential.set(value);
      render('Key ready in page memory.');
    } catch {
      render('Enter a valid fal API key.', true);
    }
  });
  input.addEventListener('input', () => render());
  clear.addEventListener('click', () => {
    controller?.abort();
    credential.clear();
    input.value = '';
    render('Key cleared from page memory.');
  });
  cancel.addEventListener('click', () => controller?.abort());
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
      await client.checkConnection(active.signal);
      if (!disposed && controller === active) render('Connected to fal.');
    } catch (error) {
      const failure = normalizeProviderFailure(error, active.signal);
      if (!disposed && controller === active) {
        render(failure.message, true);
        if (diagnosticDetails) diagnosticDetails.open = true;
      }
    } finally {
      if (controller === active) controller = null;
      if (!disposed) {
        check.disabled = !credential.ready;
        cancel.hidden = true;
      }
    }
  });

  function clearPageCredential() {
    controller?.abort();
    controller = null;
    credential.clear();
    input.value = '';
    input.type = 'password';
    reveal.textContent = 'Show';
    render('No key in page memory. Enter it again.');
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
  function onPageShow() {
    // BFCache may restore the DOM; the page remains usable with a newly entered key.
    clearPageCredential();
  }
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  render();
  return dispose;
}
