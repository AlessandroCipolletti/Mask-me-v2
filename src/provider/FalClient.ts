import type {
  ProviderClient,
  ProviderJob,
  ProviderReadJob,
  ProviderResult,
  ProviderRunOptions,
} from './ProviderClient';
import {
  ProviderError,
  errorFromStatus,
  normalizeProviderFailure,
} from './ProviderError';
import {
  browserEnvironment,
  classifyBrowserFailure,
  type FalDiagnostic,
  type FalDiagnosticSink,
  type FalOperation,
} from './FalDiagnostics';
import { VolatileCredential } from './VolatileCredential';

type Fetcher = typeof fetch;
const QUEUE_ORIGIN = 'https://queue.fal.run';
const PLATFORM_ORIGIN = 'https://api.fal.ai';
const POLL_MS = 5_000;

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProviderError('invalid_response');
  }
  return value as Record<string, unknown>;
}

function safeModelId(value: string): string {
  if (!/^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)+$/i.test(value)) {
    throw new ProviderError('invalid_request');
  }
  return value;
}

function safeRequestId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new ProviderError('invalid_response');
  }
  return value;
}

/** fal queue operations use the app alias, not an endpoint path such as /edit. */
function queueRequestBase(modelId: string, requestId: string): string {
  const parts = modelId.split('/');
  const appParts =
    parts[0] === 'workflows' || parts[0] === 'comfy'
      ? parts.slice(0, 3)
      : parts.slice(0, 2);
  return `${QUEUE_ORIGIN}/${appParts.join('/')}/requests/${requestId}`;
}

function serializeInput(input: unknown): string {
  try {
    const body = JSON.stringify(input);
    if (typeof body === 'string') return body;
  } catch {
    /* invalid model input */
  }
  throw new ProviderError('invalid_request');
}

function providerCode(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const body = value as Record<string, unknown>;
  const detail = body['detail'];
  const error = body['error'];
  if (typeof body['code'] === 'string') return body['code'];
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (
      typeof first === 'object' &&
      first !== null &&
      'type' in first &&
      typeof first.type === 'string'
    )
      return first.type;
  }
  if (
    typeof detail === 'object' &&
    detail !== null &&
    'code' in detail &&
    typeof detail.code === 'string'
  )
    return detail.code;
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    typeof error.type === 'string'
  )
    return error.type;
  return undefined;
}

async function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw new ProviderError('cancelled');
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(new ProviderError('cancelled'));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** fal transport only. Model schemas and generation policy live in later adapters. */
export class FalClient implements ProviderClient {
  private nextRequestNumber = 0;

  constructor(
    private readonly credential: VolatileCredential,
    private readonly fetcher: Fetcher = fetch,
    private readonly pollMs = POLL_MS,
    private readonly onDiagnostic?: FalDiagnosticSink,
  ) {}

  private emit(event: Omit<FalDiagnostic, 'at'>): void {
    try {
      this.onDiagnostic?.({ at: new Date().toISOString(), ...event });
    } catch {
      // Diagnostics must never change the provider request lifecycle.
    }
  }

  /** Read-only authenticated browser probe. No model execution or billable request. */
  async checkConnection(
    signal?: AbortSignal,
  ): Promise<{ endpointId: string; unit: string; currency: string }> {
    const body = record(
      await this.request(
        `${PLATFORM_ORIGIN}/v1/models/pricing?endpoint_id=fal-ai%2Fflux%2Fdev`,
        { method: 'GET', ...(signal ? { signal } : {}) },
        'pricing_check',
      ),
    );
    if (!Array.isArray(body['prices']))
      throw new ProviderError('invalid_response');
    const price = body['prices'].find((item: unknown) => {
      try {
        return record(item)['endpoint_id'] === 'fal-ai/flux/dev';
      } catch {
        return false;
      }
    });
    const item = record(price);
    if (
      item['endpoint_id'] !== 'fal-ai/flux/dev' ||
      typeof item['unit'] !== 'string' ||
      typeof item['currency'] !== 'string'
    ) {
      throw new ProviderError('invalid_response');
    }
    this.emit({ operation: 'pricing_check', step: 'response_validated' });
    return {
      endpointId: item['endpoint_id'],
      unit: item['unit'],
      currency: item['currency'],
    };
  }

  async run<T>(
    job: ProviderJob<T>,
    options: ProviderRunOptions = {},
  ): Promise<ProviderResult<T>> {
    const modelId = safeModelId(job.modelId);
    const controller = new AbortController();
    const onAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) controller.abort();
    let requestId: string | null = null;
    try {
      options.onPhase?.('submitting');
      // A POST is never retried automatically: a lost response may still represent a billed job.
      const submitted = record(
        await this.request(
          `${QUEUE_ORIGIN}/${modelId}`,
          {
            method: 'POST',
            body: serializeInput(job.input),
            signal: controller.signal,
          },
          'queue_submit',
        ),
      );
      requestId = safeRequestId(submitted['request_id']);
      options.onSubmitted?.(requestId);
      return await this.pollAndRead(
        job,
        modelId,
        requestId,
        controller.signal,
        options,
      );
    } catch (error) {
      if (
        controller.signal.aborted &&
        requestId &&
        controller.signal.reason !== 'pagehide' &&
        controller.signal.reason !== 'pause'
      ) {
        // Best effort. A running job may be impossible to cancel or may still be billed.
        try {
          await this.cancel(queueRequestBase(modelId, requestId));
        } catch {
          /* retain local cancellation */
        }
      }
      throw normalizeProviderFailure(error, controller.signal);
    } finally {
      options.signal?.removeEventListener('abort', onAbort);
    }
  }

  async resume<T>(
    job: ProviderReadJob<T>,
    requestId: string,
    options: ProviderRunOptions = {},
  ): Promise<ProviderResult<T>> {
    const modelId = safeModelId(job.modelId);
    const id = safeRequestId(requestId);
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) controller.abort();
    try {
      return await this.pollAndRead(
        job,
        modelId,
        id,
        controller.signal,
        options,
      );
    } catch (error) {
      // Stopping a read-only recovery must not cancel the original paid job.
      throw normalizeProviderFailure(error, controller.signal);
    } finally {
      options.signal?.removeEventListener('abort', onAbort);
    }
  }

  private async pollAndRead<T>(
    job: ProviderReadJob<T>,
    modelId: string,
    requestId: string,
    signal: AbortSignal,
    options: ProviderRunOptions,
  ): Promise<ProviderResult<T>> {
    const base = queueRequestBase(modelId, requestId);
    while (true) {
      if (signal.aborted) throw new ProviderError('cancelled');
      const status = record(
        await this.readWithRetry(`${base}/status`, signal, 'queue_status'),
      );
      const queueState = status['status'];
      if (
        queueState !== 'IN_QUEUE' &&
        queueState !== 'IN_PROGRESS' &&
        queueState !== 'COMPLETED'
      )
        throw new ProviderError('invalid_response');
      const queuePosition = status['queue_position'];
      this.emit({
        operation: 'queue_status',
        step: 'queue_state',
        queueState,
        ...(queueState === 'IN_QUEUE' &&
        typeof queuePosition === 'number' &&
        Number.isSafeInteger(queuePosition) &&
        queuePosition >= 0
          ? { queuePosition }
          : {}),
      });
      if (status['status'] === 'COMPLETED') break;
      if (status['status'] === 'IN_QUEUE') options.onPhase?.('queued');
      else if (status['status'] === 'IN_PROGRESS') options.onPhase?.('running');
      await wait(this.pollMs, signal);
    }
    options.onPhase?.('retrieving');
    const result = await this.readWithRetry(base, signal, 'queue_result');
    if (signal.aborted) throw new ProviderError('cancelled');
    try {
      return { data: job.parse(result), requestId };
    } catch {
      throw new ProviderError('invalid_response');
    }
  }

  private async readWithRetry(
    url: string,
    signal: AbortSignal,
    operation: FalOperation,
  ): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.request(url, { method: 'GET', signal }, operation);
      } catch (error) {
        const failure = normalizeProviderFailure(error, signal);
        // A completed queue job can temporarily return a gateway timeout while
        // fal makes its result available. Re-read the same job; never resubmit it.
        const gatewayTimeout = failure.status === 504;
        if (
          attempt >= (gatewayTimeout ? 12 : 2) ||
          failure.retryable === false ||
          ![
            'rate_limit',
            'provider_unavailable',
            'downstream_unavailable',
            'network_or_cors',
          ].includes(failure.code)
        )
          throw failure;
        await wait(gatewayTimeout ? this.pollMs : 500 * (attempt + 1), signal);
      }
    }
  }

  private async cancel(base: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      await this.request(
        `${base}/cancel`,
        {
          method: 'PUT',
          signal: controller.signal,
        },
        'queue_cancel',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async request(
    url: string,
    init: RequestInit,
    operation: FalOperation,
  ): Promise<unknown> {
    const requestNumber = ++this.nextRequestNumber;
    const method = init.method as 'GET' | 'POST' | 'PUT';
    if (!this.credential.ready || init.signal?.aborted) {
      const errorCode = this.credential.ready ? 'cancelled' : 'missing_key';
      this.emit({
        operation,
        step: 'request_preflight_failed',
        requestNumber,
        method,
        errorCode,
      });
      throw new ProviderError(errorCode);
    }
    const started = performance.now();
    let stage: 'fetch' | 'response' = 'fetch';
    let status: number | undefined;
    this.emit({
      operation,
      step: 'fetch_start',
      requestNumber,
      method,
      ...browserEnvironment(),
    });
    try {
      const response = await this.credential.withValue((key) =>
        this.fetcher.call(globalThis, url, {
          ...init,
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
          headers: {
            Authorization: `Key ${key}`,
            ...(init.body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
          },
        }),
      );
      stage = 'response';
      status = response.status;
      this.emit({
        operation,
        step: 'response_received',
        requestNumber,
        method,
        status,
        durationMs: Math.round(performance.now() - started),
      });
      let body: unknown = null;
      const raw = await response.text();
      if (raw) {
        try {
          body = JSON.parse(raw) as unknown;
        } catch {
          // Gateway and proxy errors often have an HTML body. The HTTP status
          // still determines the error and whether this read can be retried.
          if (response.ok) throw new ProviderError('invalid_response');
        }
      }
      if (!response.ok) {
        const retryHeader = response.headers.get('X-Fal-Needs-Retry');
        const retryable =
          retryHeader === 'true'
            ? true
            : retryHeader === 'false'
              ? false
              : undefined;
        throw errorFromStatus(response.status, providerCode(body), retryable);
      }
      this.emit({
        operation,
        step: 'request_complete',
        requestNumber,
        method,
        status,
        durationMs: Math.round(performance.now() - started),
      });
      return body;
    } catch (error) {
      const failure = normalizeProviderFailure(error, init.signal ?? undefined);
      this.emit({
        operation,
        step: 'request_failed',
        requestNumber,
        method,
        ...(status === undefined ? {} : { status }),
        durationMs: Math.round(performance.now() - started),
        errorCode: failure.code,
        ...(stage === 'fetch'
          ? { browserFailure: classifyBrowserFailure(error) }
          : {}),
        ...browserEnvironment(),
      });
      throw failure;
    }
  }
}
